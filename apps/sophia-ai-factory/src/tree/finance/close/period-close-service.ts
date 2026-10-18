/**
 * Finalize Period Close & Merkle Anchor Service
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-close-service
 */

import type { D1Database } from '@/seed/db/client';
import type { FinalizePeriodResult } from '@/seed/types/financial-close';
import {
  buildMerkleTree,
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';
import { getPeriodStatus, computePeriodAggregates } from './period-query-service';
import {
  fetchPeriodLeafHashes,
  recordPeriodCloseAuditEvents,
  updateClosedPeriodRecord,
} from './period-close-sql';

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

  const leafHashes = await fetchPeriodLeafHashes(db, periodKey);
  const { rootHash } = await buildMerkleTree(leafHashes);
  const digitalSignature = await hmacSha256Hex(rootHash, secret);

  await updateClosedPeriodRecord({
    db,
    periodKey,
    closedBy,
    now,
    aggregates,
    rootHash,
    digitalSignature,
    orgId,
  });

  await recordPeriodCloseAuditEvents({
    db,
    periodKey,
    orgId,
    closedBy,
    aggregates,
    rootHash,
    digitalSignature,
    totalLeaves: leafHashes.length,
    now,
    secret,
  });

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
