/**
 * @file sovereign-tier2-conclave-d1-recorder.ts
 * @layer land/governance
 * @description Shared D1 persistence helper for Tier-2 Sovereign Quadrillion-family Conclave disputes and STARK batches.
 */

import { getD1 } from '@/seed/db/client';

export interface SovereignTier2DisputeRecordInput {
  tableName: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  evidenceSha256: string;
  totalJurors: number;
  claimantVotes: number;
  respondentVotes: number;
  effectiveSupermajorityPct: number;
  jurorsSlashedCount: number;
  totalSlashedStakeCents: number;
  executedRemedyCents: number;
  verdict: string;
  rulingHash: string;
}

export interface SovereignTier2StarkRecordInput {
  tableName: string;
  batchRefPrefix: string;
  newStateRootColumn?: 'new_state_root' | 'newState_root';
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeNanos: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  compactionDigest: string;
}

export async function recordTier2ConclaveDispute(
  p: SovereignTier2DisputeRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, evidence_sha256, total_jurors, claimant_votes, respondent_votes, supermajority_pct, jurors_slashed_count, total_slashed_stake_cents, executed_remedy_cents, verdict, ruling_hash, ruled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      p.disputeCaseRef,
      p.claimantParticipantId,
      p.respondentParticipantId,
      p.disputeValueCents,
      p.evidenceSha256,
      p.totalJurors,
      p.claimantVotes,
      p.respondentVotes,
      p.effectiveSupermajorityPct,
      p.jurorsSlashedCount,
      p.totalSlashedStakeCents,
      p.executedRemedyCents,
      p.verdict,
      p.rulingHash
    )
    .run();
}

export async function recordTier2StarkBatch(
  p: SovereignTier2StarkRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const col = p.newStateRootColumn ?? 'new_state_root';
  const batchRef = `${p.batchRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, batch_ref, batch_tx_count, previous_state_root, ${col}, proof_bytes_length, verification_time_nanos, circuit_identifier, is_mathematically_sound, stark_digest, compacted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      batchRef,
      p.batchTransactionCount,
      p.previousStateRoot,
      p.newStateRoot,
      p.starkProofBytesLength,
      p.verificationTimeNanos,
      p.verifierCircuitIdentifier,
      p.isMathematicallySound ? 1 : 0,
      p.compactionDigest
    )
    .run();
}
