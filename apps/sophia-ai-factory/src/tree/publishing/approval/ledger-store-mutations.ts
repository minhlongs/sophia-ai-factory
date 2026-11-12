/**
 * Publish Ledger Store Mutations (Claim & Resolve)
 * Layer: TREE (domain-specific reusable)
 *
 * Atomic claim and terminal decision writes for the publish approval ledger.
 *
 * @module tree/publishing/approval/ledger-store-mutations
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { computePublishIdempotencyKey } from './idempotency-key';
import { toRequesterId } from './requester-identity';
import {
  PUBLISH_LEDGER_TABLE,
  ensurePublishLedgerTable,
  mapLedgerRow,
  type LedgerRow,
} from './ledger-store';
import type { PublishApprovalDecision, PublishApprovalSubject, PublishLedgerRecord } from './types';

/**
 * Atomically records a `pending` approval request. The insert is the claim: a
 * second request for the same subject loses the write and learns it is not the
 * owner, so a duplicate delivery cannot enqueue a second human decision.
 */
export async function claimPublishApprovalRequest(
  input: PublishApprovalSubject & { expiresAt: number; requesterId?: string },
  overrideDb?: D1Database,
): Promise<{ claimed: boolean; key: string }> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  await ensurePublishLedgerTable(db);
  const key = await computePublishIdempotencyKey(input);
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare(
      `INSERT INTO ${PUBLISH_LEDGER_TABLE}
         (idempotency_key, tenant_id, channel_id, platform, media_ref, decision, requester_id, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7, ?8)
       ON CONFLICT (idempotency_key) DO NOTHING`,
    )
    .bind(
      key,
      input.tenantId,
      input.channelId,
      input.platform,
      input.mediaRef,
      // Applied at the write so every lane is covered, including one that
      // forwards its own scheduled-lane identifier in the user slot.
      toRequesterId(input.requesterId) ?? null,
      now,
      input.expiresAt,
    )
    .run();
  const changes = (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  return { claimed: changes === 1, key };
}

/**
 * Writes the human's terminal decision. Guarded on `pending`, so a late-arriving
 * duplicate resolution cannot overwrite a decision that already landed — the
 * first reviewer's answer is the one that counts.
 */
export async function resolvePublishApproval(
  input: {
    subject: PublishApprovalSubject;
    decision: PublishApprovalDecision;
    reviewerId: string;
    comment?: string;
  },
  overrideDb?: D1Database,
): Promise<Result<PublishLedgerRecord, { code: string; message: string }>> {
  try {
    const db = overrideDb ?? (await getD1());
    if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 not available' });
    const key = await computePublishIdempotencyKey(input.subject);
    const now = Math.floor(Date.now() / 1000);
    const res = await db
      .prepare(
        `UPDATE ${PUBLISH_LEDGER_TABLE}
            SET decision = ?1, reviewer_id = ?2, comment = ?3, approved_at = ?4
          WHERE idempotency_key = ?5 AND tenant_id = ?6 AND decision = 'pending'`,
      )
      .bind(
        input.decision,
        input.reviewerId,
        input.comment ?? null,
        input.decision === 'approved' ? now : null,
        key,
        input.subject.tenantId,
      )
      .run();
    const changes = (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
    if (changes === 0) {
      return failure({
        code: 'ALREADY_RESOLVED',
        message: 'This publish approval was already resolved',
      });
    }
    const row = await db
      .prepare(
        `SELECT * FROM ${PUBLISH_LEDGER_TABLE} WHERE idempotency_key = ?1 AND tenant_id = ?2 LIMIT 1`,
      )
      .bind(key, input.subject.tenantId)
      .first<LedgerRow>();
    if (!row) return failure({ code: 'NOT_FOUND', message: 'Publish approval row vanished' });
    return success(mapLedgerRow(row));
  } catch (err) {
    logger.error('publishLedger: resolve failed', {
      error: err instanceof Error ? err.message : String(err),
      platform: input.subject.platform,
    });
    return failure({
      code: 'DB_ERROR',
      message: err instanceof Error ? err.message : 'Unknown DB error',
    });
  }
}
