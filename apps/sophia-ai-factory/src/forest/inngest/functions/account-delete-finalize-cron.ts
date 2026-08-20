/**
 * Inngest cron: auto-finalize account deletion after 7-day cooldown elapsed.
 *
 * Wave 22 Phase 06.
 *
 * Schedule: every 6 hours (UTC). Scans `account_deletion_requests` for rows
 * that are confirmed, not cancelled, and past the scheduled finalize time.
 * For each row:
 *   1. Cascade-delete tenant data via shared `cascadeDeleteAccount` util
 *      (same logic as the manual `DELETE /api/account` endpoint).
 *   2. Best-effort send a deletion-complete email (failure non-fatal — we
 *      can't recover deleted data, so notification is informational only).
 *
 * Idempotent: re-running on already-deleted tenants is a no-op (cooldown row
 * cleanup happens inside the cascade util).
 *
 * @module forest/inngest/functions/account-delete-finalize-cron
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client'
import { sendEmail } from '@/tree/email/sender';
import { logger } from '@/seed/utils/logger-utility';
import { cascadeDeleteAccount } from '@/land/account';
import { buildDeletionCompleteHtml } from './account-delete-finalize-email';

const FETCH_LIMIT = 50;

interface PendingRow {
  user_id: string;
  tenant_id: string;
  user_email: string | null;
}

export const accountDeleteFinalizeCron = inngest.createFunction(
  { id: 'account-delete-finalize-cron', retries: 1 },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const pending = await step.run('fetch-pending', async (): Promise<PendingRow[]> => {
      const _db = await getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const db = _db;
      const rs = await db
        .prepare(
          `SELECT adr.user_id AS user_id, adr.tenant_id AS tenant_id, u.email AS user_email
           FROM account_deletion_requests adr
           LEFT JOIN user u ON u.id = adr.user_id
           WHERE adr.confirmed_at IS NOT NULL
             AND adr.cancelled_at IS NULL
             AND adr.scheduled_at <= unixepoch()
           LIMIT ${FETCH_LIMIT}`,
        )
        .all<PendingRow>();
      return (rs.results ?? []) as PendingRow[];
    });

    let processed = 0;
    let totalDeleted = 0;

    for (const row of pending) {
      const result = await step.run(`cascade-${row.user_id}`, async () => {
        const _db = await getD1();
        if (!_db) throw new Error('D1 database binding not available');
        const db = _db;
        return cascadeDeleteAccount(db, row.user_id, row.tenant_id);
      });
      totalDeleted += result.totalDeleted;
      processed++;

      if (row.user_email) {
        await step.run(`notify-${row.user_id}`, async () => {
          try {
            await sendEmail({
              to: row.user_email!,
              subject: 'Sophia AI account deleted · Tài khoản đã xoá',
              html: buildDeletionCompleteHtml(),
              tags: [{ name: 'kind', value: 'account-delete-complete' }],
            });
          } catch (err) {
            logger.warn('[delete-cron] notify failed', {
              userId: row.user_id,
              error: String(err),
            });
          }
        });
      }
    }

    logger.info('[delete-cron] run complete', { processed, totalDeleted });
    return { processed, totalDeleted };
  },
);
