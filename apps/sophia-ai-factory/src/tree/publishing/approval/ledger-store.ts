/**
 * Publish Ledger Store
 * Layer: TREE (domain-specific reusable)
 *
 * One row per (workspace, channel, platform, media) tuple. The row is the
 * record of a human decision, and the unique index on its idempotency key is
 * what makes "two deliveries of the same publish, or two jobs for the same
 * media, cannot both get a fresh approval request" true at the database rather
 * than in application code.
 *
 * @module tree/publishing/approval/ledger-store
 */

import { getD1, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { computePublishIdempotencyKey } from './idempotency-key';
import type { PublishApprovalDecision, PublishApprovalSubject, PublishLedgerRecord } from './types';

export const PUBLISH_LEDGER_TABLE = 'publish_ledger';

interface LedgerRow {
  idempotency_key: string;
  tenant_id: string;
  channel_id: string;
  platform: string;
  media_ref: string;
  decision: string;
  reviewer_id: string | null;
  comment: string | null;
  approved_at: number | null;
  expires_at: number | null;
  created_at: number;
}

function mapLedgerRow(row: LedgerRow): PublishLedgerRecord {
  return {
    idempotencyKey: row.idempotency_key,
    tenantId: row.tenant_id,
    channelId: row.channel_id,
    platform: row.platform,
    mediaRef: row.media_ref,
    decision: row.decision as PublishApprovalDecision,
    reviewerId: row.reviewer_id ?? undefined,
    comment: row.comment ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: Number(row.created_at),
  };
}

export async function ensurePublishLedgerTable(overrideDb?: D1Database): Promise<void> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${PUBLISH_LEDGER_TABLE} (
    idempotency_key TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    media_ref TEXT NOT NULL,
    decision TEXT NOT NULL DEFAULT 'pending',
    reviewer_id TEXT,
    comment TEXT,
    approved_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL
  )`).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_publish_ledger_tenant ON ${PUBLISH_LEDGER_TABLE}(tenant_id, created_at DESC)`,
  ).run();
}

/**
 * Reads the decision already recorded for this exact subject, if any. Returns
 * `null` both when no row exists and when the read fails, because a caller that
 * cannot see a prior approval must request one rather than assume it.
 */
export async function getPublishLedgerRecord(
  subject: PublishApprovalSubject,
  overrideDb?: D1Database,
): Promise<PublishLedgerRecord | null> {
  try {
    const db = overrideDb ?? (await getD1());
    if (!db) return null;
    const key = await computePublishIdempotencyKey(subject);
    const row = await db
      .prepare(`SELECT * FROM ${PUBLISH_LEDGER_TABLE} WHERE idempotency_key = ?1 LIMIT 1`)
      .bind(key)
      .first<LedgerRow>();
    return row ? mapLedgerRow(row) : null;
  } catch (err) {
    logger.warn('publishLedger: read failed, treating as no prior approval', {
      error: err instanceof Error ? err.message : String(err),
      platform: subject.platform,
      channelId: subject.channelId,
    });
    return null;
  }
}

/**
 * Reads one ledger row by its key. A reviewer resolving a request knows the key
 * and not the full subject, so the key is the lookup the UI drives; it is also
 * the only lookup that cannot be tricked by re-normalizing the subject fields.
 */
export async function getPublishLedgerRecordByKey(
  idempotencyKey: string,
  overrideDb?: D1Database,
): Promise<PublishLedgerRecord | null> {
  try {
    const db = overrideDb ?? (await getD1());
    if (!db) return null;
    const row = await db
      .prepare(`SELECT * FROM ${PUBLISH_LEDGER_TABLE} WHERE idempotency_key = ?1 LIMIT 1`)
      .bind(idempotencyKey)
      .first<LedgerRow>();
    return row ? mapLedgerRow(row) : null;
  } catch (err) {
    logger.warn('publishLedger: keyed read failed, treating as no prior approval', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Lists pending approvals for the given tenants, newest first. A reviewer sees
 * only the rows their workspaces own, so the tenant list is the scope of the
 * query rather than a filter applied afterwards.
 */
export async function listPendingPublishApprovals(
  tenantIds: readonly string[],
  limit = 50,
  overrideDb?: D1Database,
): Promise<PublishLedgerRecord[]> {
  if (tenantIds.length === 0) return [];
  try {
    const db = overrideDb ?? (await getD1());
    if (!db) return [];
    const placeholders = tenantIds.map(() => '?').join(',');
    const rows = await db
      .prepare(
        `SELECT * FROM ${PUBLISH_LEDGER_TABLE}
         WHERE decision = 'pending' AND tenant_id IN (${placeholders})
         ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(...tenantIds, limit)
      .all<LedgerRow>();
    return (rows.results ?? []).map(mapLedgerRow);
  } catch (err) {
    logger.warn('publishLedger: pending list failed', {
      error: err instanceof Error ? err.message : String(err),
      tenantCount: tenantIds.length,
    });
    return [];
  }
}

/**
 * Atomically records a `pending` approval request. The insert is the claim: a
 * second request for the same subject loses the write and learns it is not the
 * owner, so a duplicate delivery cannot enqueue a second human decision.
 */
export async function claimPublishApprovalRequest(
  input: PublishApprovalSubject & { expiresAt: number },
  overrideDb?: D1Database,
): Promise<{ claimed: boolean; key: string }> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  const key = await computePublishIdempotencyKey(input);
  const now = Math.floor(Date.now() / 1000);
  const res = await db
    .prepare(
      `INSERT INTO ${PUBLISH_LEDGER_TABLE}
         (idempotency_key, tenant_id, channel_id, platform, media_ref, decision, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
    )
    .bind(key, input.tenantId, input.channelId, input.platform, input.mediaRef, now, input.expiresAt)
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
  input: { subject: PublishApprovalSubject; decision: PublishApprovalDecision; reviewerId: string; comment?: string },
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
          WHERE idempotency_key = ?5 AND decision = 'pending'`,
      )
      .bind(input.decision, input.reviewerId, input.comment ?? null, input.decision === 'approved' ? now : null, key)
      .run();
    const changes = (res as { meta?: { changes?: number } })?.meta?.changes ?? 0;
    if (changes === 0) {
      return failure({ code: 'ALREADY_RESOLVED', message: 'This publish approval was already resolved' });
    }
    const row = await db
      .prepare(`SELECT * FROM ${PUBLISH_LEDGER_TABLE} WHERE idempotency_key = ?1 LIMIT 1`)
      .bind(key)
      .first<LedgerRow>();
    if (!row) return failure({ code: 'NOT_FOUND', message: 'Publish approval row vanished' });
    return success(mapLedgerRow(row));
  } catch (err) {
    logger.error('publishLedger: resolve failed', {
      error: err instanceof Error ? err.message : String(err),
      platform: input.subject.platform,
    });
    return failure({ code: 'DB_ERROR', message: err instanceof Error ? err.message : 'Unknown DB error' });
  }
}
