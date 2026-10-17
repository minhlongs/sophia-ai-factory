/**
 * Email outbox failure handling, exponential backoff, and admin Telegram alert.
 *
 * @module tree/email/outbox-failure-handler
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';

export const MAX_ATTEMPTS = 5;

export interface OutboxRow {
  id: string;
  to_email: string;
  template: string;
  payload: string;
  attempts: number;
  locked_at?: number | null;
}

export async function handleOutboxFailure(
  db: D1Database,
  row: OutboxRow,
  error: string,
  now: number,
): Promise<void> {
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

export async function sendAdminAlert(message: string): Promise<void> {
  if (!shouldAllowRequest('telegram')) {
    return;
  }
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    if (res.ok) recordSuccess('telegram');
    else recordFailure('telegram', classifyError(new Error(`HTTP ${res.status}`)));
  } catch (err) {
    recordFailure('telegram', classifyError(err));
    // best-effort — never propagate
  }
}
