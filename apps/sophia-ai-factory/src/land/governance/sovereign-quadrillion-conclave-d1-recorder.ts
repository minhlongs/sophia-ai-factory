/**
 * @file sovereign-quadrillion-conclave-d1-recorder.ts
 * @layer land/governance
 * @description Shared D1 persistence helper for Sovereign Quadrillion-tier Conclave disputes, braided STARK batches, and constitutional invariants.
 */

import { getD1 } from '@/seed/db/client';

export interface SovereignQuadrillionDisputeRecordInput {
  tablePrefix: string;
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

export interface SovereignQuadrillionStarkRecordInput {
  tablePrefix: string;
  batchRefPrefix: string;
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeNanos: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  compactionDigest: string;
}

export interface SovereignQuadrillionInvariantRecordInput {
  tablePrefix: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  verificationHash: string;
}

export async function recordQuadrillionConclaveDispute(
  p: SovereignQuadrillionDisputeRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO sovereign_${p.tablePrefix}_conclave_disputes (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, evidence_sha256, total_jurors, claimant_votes, respondent_votes, supermajority_pct, jurors_slashed_count, total_slashed_stake_cents, executed_remedy_cents, verdict, ruling_hash, ruled_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), p.disputeCaseRef, p.claimantParticipantId, p.respondentParticipantId,
      p.disputeValueCents, p.evidenceSha256, p.totalJurors, p.claimantVotes, p.respondentVotes,
      p.effectiveSupermajorityPct, p.jurorsSlashedCount, p.totalSlashedStakeCents,
      p.executedRemedyCents, p.verdict, p.rulingHash
    )
    .run();
}

export async function recordQuadrillionBraidedStarkBatch(
  p: SovereignQuadrillionStarkRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const batchRef = `${p.batchRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await db
    .prepare(
      `INSERT INTO ${p.tablePrefix}_braided_stark_batches (id, batch_ref, batch_tx_count, previous_state_root, new_state_root, proof_bytes_length, verification_time_nanos, circuit_identifier, is_mathematically_sound, stark_digest, compacted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), batchRef, p.batchTransactionCount, p.previousStateRoot, p.newStateRoot,
      p.starkProofBytesLength, p.verificationTimeNanos, p.verifierCircuitIdentifier,
      p.isMathematicallySound ? 1 : 0, p.compactionDigest
    )
    .run();
}

export async function recordQuadrillionConstitutionalInvariant(
  p: SovereignQuadrillionInvariantRecordInput
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT OR REPLACE INTO ${p.tablePrefix}_empire_constitutional_invariants (id, article_code, article_title, is_strictly_immutable, last_theorem_verified_at, enforcement_circuit_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'), ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), p.articleCode, p.articleTitle,
      p.isStrictlyImmutable ? 1 : 0, p.verificationHash
    )
    .run();
}
