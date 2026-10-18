/**
 * Period Close SQL Updates & Merkle Audit Trail Helpers
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-close-sql
 */

import type { D1Database } from '@/seed/db/client';
import type { PeriodAggregates } from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';

export async function fetchPeriodLeafHashes(
  db: D1Database,
  periodKey: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT merkle_leaf_hash FROM ipo_audit_ledger
       WHERE period_key = ?1 ORDER BY sequence_number ASC`,
    )
    .bind(periodKey)
    .all<{ merkle_leaf_hash: string }>();

  return (results ?? []).map((r) => r.merkle_leaf_hash);
}

export async function updateClosedPeriodRecord(params: {
  db: D1Database;
  periodKey: string;
  closedBy: string;
  now: number;
  aggregates: PeriodAggregates;
  rootHash: string;
  digitalSignature: string;
  orgId?: string | null;
}): Promise<void> {
  const { db, periodKey, closedBy, now, aggregates, rootHash, digitalSignature, orgId } = params;

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'closed', closed_by = ?1, closed_at = ?2,
           total_recognized_revenue_cents = ?3, total_deferred_revenue_cents = ?4,
           total_refunds_cents = ?5, net_revenue_cents = ?6,
           active_contracts_count = ?7, merkle_root_hash = ?8,
           digital_signature = ?9, updated_at = ?10
       WHERE period_key = ?11 AND (org_id = ?12 OR (org_id IS NULL AND ?12 IS NULL))`,
    )
    .bind(
      closedBy,
      now,
      aggregates.recognizedRevenueCents,
      aggregates.deferredRevenueCents,
      aggregates.refundsCents,
      aggregates.netRevenueCents,
      aggregates.activeContractsCount,
      rootHash,
      digitalSignature,
      now,
      periodKey,
      orgId ?? null,
    )
    .run();
}

export async function recordPeriodCloseAuditEvents(params: {
  db: D1Database;
  periodKey: string;
  orgId?: string | null;
  closedBy: string;
  aggregates: PeriodAggregates;
  rootHash: string;
  digitalSignature: string;
  totalLeaves: number;
  now: number;
  secret: string;
}): Promise<void> {
  const { db, periodKey, orgId, closedBy, aggregates, rootHash, digitalSignature, totalLeaves, now, secret } = params;

  await appendIpoAuditEvent(
    db,
    {
      periodKey,
      orgId,
      eventType: 'PERIOD_CLOSED',
      eventScope: orgId ? 'entity_level' : 'consolidated_group',
      actorId: closedBy,
      actorRole: 'CFO',
      amountCents: aggregates.recognizedRevenueCents,
      payload: { action: 'finalize_period_close', aggregates, merkleRootHash: rootHash, closedAt: now },
      soxControlId: 'AC-4.1',
      vasAccountCode: '511',
    },
    secret,
  );

  await appendIpoAuditEvent(
    db,
    {
      periodKey,
      orgId,
      eventType: 'MERKLE_ROOT_ANCHORED',
      eventScope: 'system_wide',
      actorId: closedBy,
      actorRole: 'SYSTEM',
      payload: { merkleRootHash: rootHash, digitalSignature, totalLeaves },
      soxControlId: 'CC-3.2',
    },
    secret,
  );
}
