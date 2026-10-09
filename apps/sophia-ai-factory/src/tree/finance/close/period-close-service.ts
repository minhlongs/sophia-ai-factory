/**
 * Finalize Period Close & Merkle Anchor Service
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-close-service
 */

import type { D1Database } from '@/seed/db/client';
import type { FinalizePeriodResult } from '@/seed/types/financial-close';
import {
  appendIpoAuditEvent,
  buildMerkleTree,
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';
import { getPeriodStatus, computePeriodAggregates } from './period-query-service';

/**
 * Finalize close for a period, locking financial totals and anchoring Merkle root (FSM: closing -> closed)
 */
export async function finalizePeriodClose(
  db: D1Database,
  periodKey: string,
  closedBy: string,
  secret: string = DEFAULT_AUDIT_SECRET,
  orgId?: string | null
): Promise<FinalizePeriodResult> {
  const period = await getPeriodStatus(db, periodKey, orgId);
  if (!period) {
    throw new Error(`Period ${periodKey} not found`);
  }

  if (period.closeStatus === 'locked') {
    throw new Error(`PERIOD_LOCKED: Period ${periodKey} is locked and immutable.`);
  }

  const aggregates = await computePeriodAggregates(db, periodKey, orgId);
  const now = Date.now();

  // Fetch all audit leaf hashes for this period
  const { results } = await db
    .prepare(
      `SELECT merkle_leaf_hash FROM ipo_audit_ledger
       WHERE period_key = ?1
       ORDER BY sequence_number ASC`
    )
    .bind(periodKey)
    .all<{ merkle_leaf_hash: string }>();

  const leafHashes = (results ?? []).map((r) => r.merkle_leaf_hash);
  const { rootHash } = await buildMerkleTree(leafHashes);
  const digitalSignature = await hmacSha256Hex(rootHash, secret);

  await db
    .prepare(
      `UPDATE financial_close_periods
       SET close_status = 'closed',
           closed_by = ?1,
           closed_at = ?2,
           total_recognized_revenue_cents = ?3,
           total_deferred_revenue_cents = ?4,
           total_refunds_cents = ?5,
           net_revenue_cents = ?6,
           active_contracts_count = ?7,
           merkle_root_hash = ?8,
           digital_signature = ?9,
           updated_at = ?10
       WHERE period_key = ?11 AND (org_id = ?12 OR (org_id IS NULL AND ?12 IS NULL))`
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
      orgId ?? null
    )
    .run();

  // Log finalization and Merkle anchor in audit ledger
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
      payload: {
        action: 'finalize_period_close',
        aggregates,
        merkleRootHash: rootHash,
        closedAt: now,
      },
      soxControlId: 'AC-4.1',
      vasAccountCode: '511',
    },
    secret
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
      payload: { merkleRootHash: rootHash, digitalSignature, totalLeaves: leafHashes.length },
      soxControlId: 'CC-3.2',
    },
    secret
  );

  const updatedPeriod = await getPeriodStatus(db, periodKey, orgId);
  if (!updatedPeriod) {
    throw new Error(`Failed to retrieve finalized period: ${periodKey}`);
  }

  return {
    period: updatedPeriod,
    merkleRootHash: rootHash,
    digitalSignature,
    totalLedgerEvents: leafHashes.length + 2,
    aggregates,
  };
}
