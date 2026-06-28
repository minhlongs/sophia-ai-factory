/**
 * Welcome email outbox — durable enqueue + flush with exponential backoff retry.
 * Uses D1 table welcome_email_outbox (migration 0073).
 * @module lib/outbox/email-outbox
 */

import { logger } from '@/seed/utils/logger-utility';
import { sendEmail } from '@/forest/email/sender';
import { renderEmail, type TemplateKey, type TemplateDataMap } from '@/forest/email/render-email';
import { SENDER_FROM } from '@/forest/email/templates/shared-layout';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

export interface EnqueueEmailInput {
  paymentId: string;
  toEmail: string;
  template: TemplateKey;
  payload: Record<string, unknown>;
}

/** Insert one row into the outbox. Idempotent on payment_id (UNIQUE). */
export async function enqueueWelcomeEmail(db: D1Database, input: EnqueueEmailInput): Promise<void> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO welcome_email_outbox
         (id, payment_id, to_email, template, payload, status, attempts, next_retry_at, created_at)
         VALUES (?1,?2,?3,?4,?5,'pending',0,?6,?7)`,
      )
      .bind(id, input.paymentId, input.toEmail, input.template, JSON.stringify(input.payload), now, now)
      .run();
    logger.info('[EmailOutbox] Enqueued', { paymentId: input.paymentId, template: input.template });
  } catch (err) {
    logger.error('[EmailOutbox] Enqueue failed', err instanceof Error ? err : new Error(String(err)));
  }
}

interface OutboxRow {
  id: string;
  to_email: string;
  template: string;
  payload: string;
  attempts: number;
  locked_at?: number | null;
}

/** Process up to BATCH_SIZE pending rows; return {sent, failed, skipped} summary. */
export async function flushOutbox(db: D1Database): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = Math.floor(Date.now() / 1000);
  const lockExpirySec = 5 * 60; // 5 minutes — stale lock threshold

  // Claim rows atomically before reading — prevents concurrent cron runs from
  // grabbing the same rows and sending duplicate emails.
  await db
    .prepare(
      `UPDATE welcome_email_outbox
       SET status = 'processing', locked_at = ?1
       WHERE status = 'pending'
         AND next_retry_at <= ?1
         AND (locked_at IS NULL OR locked_at < ?2)
       LIMIT ?3`,
    )
    .bind(now, now - lockExpirySec, BATCH_SIZE)
    .run();

  // Only fetch the rows WE just locked (locked_at == now and status == 'processing')
  const result = await db
    .prepare(
      `SELECT id, to_email, template, payload, attempts
       FROM welcome_email_outbox
       WHERE status = 'processing' AND locked_at = ?1
       ORDER BY next_retry_at ASC
       LIMIT ?2`,
    )
    .bind(now, BATCH_SIZE)
    .all<OutboxRow>();

  const rows = result.results ?? [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const templateKey = row.template as TemplateKey;
      const data = JSON.parse(row.payload) as TemplateDataMap[typeof templateKey];
      const { html, text, subject } = renderEmail(templateKey, data);

      const emailResult = await sendEmail({
        to: row.to_email,
        from: SENDER_FROM,
        subject,
        html,
        text,
      });

      if (emailResult.success) {
        await db
          .prepare(`UPDATE welcome_email_outbox SET status='sent', locked_at=NULL, sent_at=?1, last_error=NULL WHERE id=?2`)
          .bind(now, row.id)
          .run();
        sent++;
        logger.info('[EmailOutbox] Sent', { id: row.id, to: row.to_email });
      } else {
        await handleFailure(db, row, emailResult.error ?? 'Unknown', now);
        failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        await handleFailure(db, row, msg, now);
      } catch (handleErr) {
        // handleFailure itself failed — force-release the lock so the row
        // is not permanently stuck in 'processing' state.
        logger.error('[EmailOutbox] handleFailure threw, force-releasing lock', {
          id: row.id,
          cause: handleErr instanceof Error ? handleErr.message : String(handleErr),
        });
        await db
          .prepare(`UPDATE welcome_email_outbox SET status='pending', locked_at=NULL, attempts=?1, last_error=?2, next_retry_at=?3 WHERE id=?4`)
          .bind(row.attempts + 1, msg.slice(0, 500), now + 120, row.id)
          .run();
      }
      failed++;
    }
  }

  skipped = BATCH_SIZE - rows.length;
  logger.info('[EmailOutbox] Flush complete', { sent, failed, rows: rows.length });
  return { sent, failed, skipped };
}

async function handleFailure(db: D1Database, row: OutboxRow, error: string, now: number): Promise<void> {
  const newAttempts = row.attempts + 1;
  if (newAttempts >= MAX_ATTEMPTS) {
    await db
      .prepare(`UPDATE welcome_email_outbox SET status='failed', locked_at=NULL, attempts=?1, last_error=?2 WHERE id=?3`)
      .bind(newAttempts, error.slice(0, 500), row.id)
      .run();
    logger.warn('[EmailOutbox] Max retries reached — marking failed', { id: row.id, error });
    await sendAdminAlert(`📧 Email outbox row failed after ${MAX_ATTEMPTS} attempts.\nRow: ${row.id}\nError: ${error.slice(0, 200)}`);
  } else {
    // Exponential backoff: 2^attempts minutes. Reset to 'pending' so next cron run can re-claim.
    const backoffSec = Math.pow(2, newAttempts) * 60;
    const nextRetry = now + backoffSec;
    await db
      .prepare(`UPDATE welcome_email_outbox SET status='pending', locked_at=NULL, attempts=?1, next_retry_at=?2, last_error=?3 WHERE id=?4`)
      .bind(newAttempts, nextRetry, error.slice(0, 500), row.id)
      .run();
    logger.warn('[EmailOutbox] Retry scheduled', { id: row.id, attempt: newAttempts, nextRetryIn: backoffSec });
  }
}

async function sendAdminAlert(message: string): Promise<void> {
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch {
    // best-effort — never propagate
  }
}
