/**
 * Provenance Read Queries — chain, derivative, timeline, and agent-run lookups.
 *
 * @module tree/provenance/provenance-queries
 */

import { getD1 } from '@/seed/db/client';
import type { ProvenanceRecord } from '@/seed/types/creative-domain';
import { ProvenanceError, rowToDomain, type ProvenanceRow } from './types';

export async function getProvenanceChain(assetId: string): Promise<ProvenanceRecord[]> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM provenance_records WHERE asset_id = ?1 ORDER BY created_at ASC`)
    .bind(assetId)
    .all<ProvenanceRow>();

  return (result.results ?? []).map(rowToDomain);
}

export async function getDerivatives(assetId: string): Promise<ProvenanceRecord[]> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM provenance_records WHERE derivative_of = ?1 ORDER BY created_at ASC`)
    .bind(assetId)
    .all<ProvenanceRow>();

  return (result.results ?? []).map(rowToDomain);
}

/**
 * Chronological timeline for an asset: every provenance record for the
 * asset, ordered by creation time. Equivalent to `getProvenanceChain`
 * but named for the timeline view used by the dashboard.
 */
export async function getProvenanceTimeline(assetId: string): Promise<ProvenanceRecord[]> {
  return getProvenanceChain(assetId);
}

/**
 * All provenance records linked to a specific agent run.
 *
 * Useful for auditing what a single agent execution produced and what
 * model/tools were used.
 */
export async function getAgentRunProvenance(runId: string): Promise<ProvenanceRecord[]> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT * FROM provenance_records WHERE agent_run_id = ?1 ORDER BY created_at ASC`,
    )
    .bind(runId)
    .all<ProvenanceRow>();

  return (result.results ?? []).map(rowToDomain);
}
