/**
 * @file conclave-d1-recorder.ts
 * @layer land/governance
 * @description Shared D1 persistence helper for Sovereign, Trans-Dimensional, and Infinite Conclave actions.
 */

import { getD1 } from '@/seed/db/client';

export interface SovereignDisputeRecordInput {
  tablePrefix: string; disputeCaseRef: string; claimantParticipantId: string; respondentParticipantId: string;
  disputeValueCents: number; evidenceSha256: string; totalJurors: number; claimantVotes: number;
  respondentVotes: number; effectiveSupermajorityPct: number; jurorsSlashedCount: number;
  totalSlashedStakeCents: number; executedRemedyCents: number; verdict: string; rulingHash: string;
}

export interface SovereignBraidedStarkRecordInput {
  tablePrefix: string; batchRefPrefix: string; batchTransactionCount: number; previousStateRoot: string;
  newStateRoot: string; starkProofBytesLength: number; verificationTimeNanos: number;
  verifierCircuitIdentifier: string; isMathematicallySound: boolean; compactionDigest: string;
}

export interface SovereignInvariantRecordInput {
  tablePrefix: string; articleCode: string; articleTitle: string; isStrictlyImmutable: boolean; verificationHash: string;
}

export async function recordSovereignConclaveDispute(p: SovereignDisputeRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO sovereign_${p.tablePrefix}_conclave_disputes (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, evidence_sha256, total_jurors, claimant_votes, respondent_votes, supermajority_pct, jurors_slashed_count, total_slashed_stake_cents, executed_remedy_cents, verdict, ruling_hash, ruled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), p.disputeCaseRef, p.claimantParticipantId, p.respondentParticipantId,
      p.disputeValueCents, p.evidenceSha256, p.totalJurors, p.claimantVotes, p.respondentVotes,
      p.effectiveSupermajorityPct, p.jurorsSlashedCount, p.totalSlashedStakeCents,
      p.executedRemedyCents, p.verdict, p.rulingHash
    )
    .run();
}

export async function recordSovereignBraidedStarkBatch(p: SovereignBraidedStarkRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const batchRef = `${p.batchRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await db
    .prepare(
      `INSERT INTO ${p.tablePrefix}_braided_stark_batches (id, batch_ref, batch_tx_count, previous_state_root, newState_root, proof_bytes_length, verification_time_nanos, circuit_identifier, is_mathematically_sound, stark_digest, compacted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(), batchRef, p.batchTransactionCount, p.previousStateRoot, p.newStateRoot,
      p.starkProofBytesLength, p.verificationTimeNanos, p.verifierCircuitIdentifier,
      p.isMathematicallySound ? 1 : 0, p.compactionDigest
    )
    .run();
}

export async function recordSovereignConstitutionalInvariant(p: SovereignInvariantRecordInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tablePrefix}_empire_constitutional_invariants (id, article_code, article_title, is_strictly_immutable, last_theorem_verified_at, enforcement_circuit_hash) VALUES (?, ?, ?, ?, datetime('now'), ?) ON CONFLICT(article_code) DO UPDATE SET last_theorem_verified_at = datetime('now'), enforcement_circuit_hash = excluded.enforcement_circuit_hash`
    )
    .bind(crypto.randomUUID(), p.articleCode, p.articleTitle, p.isStrictlyImmutable ? 1 : 0, p.verificationHash)
    .run();
}

export async function recordContinuumConclaveArbitration(
  tableName: 'trans_dimensional_conclave_arbitrations' | 'infinite_conclave_arbitrations',
  input: { disputeCaseRef: string; claimantParticipantId: string; respondentParticipantId: string; disputeValueCents: number; evidenceSha256: string; votes: readonly unknown[]; supermajorityThresholdPct?: number },
  data: { rulingHash: string; verdict: string; jurorsSlashedCount: number; executedRemedyCents: number },
  defaultThresholdPct: number
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, contract_stark_root, evidence_sha256, conclave_juror_count, supermajority_threshold_pct, verdict, jurors_slashed_count, executed_remedy_cents, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(), input.disputeCaseRef, input.claimantParticipantId, input.respondentParticipantId,
      input.disputeValueCents, data.rulingHash, input.evidenceSha256, input.votes.length,
      input.supermajorityThresholdPct ?? defaultThresholdPct, data.verdict, data.jurorsSlashedCount,
      data.executedRemedyCents, new Date().toISOString()
    )
    .run();
}

export async function recordContinuumStarkCompactionProof(
  tableName: 'non_euclidean_stark_compaction_proofs' | 'non_archimedean_stark_compaction_proofs',
  proofRefPrefix: string,
  data: { batchTransactionCount: number; previousStateRoot: string; newStateRoot: string; starkProofBytesLength: number; verificationTimeMicros: number; verifierCircuitIdentifier: string; isMathematicallySound: boolean }
): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${tableName} (id, proof_ref, batch_transaction_count, previous_state_root, new_state_root, stark_proof_bytes_length, verification_time_micros, verifier_circuit_identifier, is_mathematically_sound, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(), `${proofRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      data.batchTransactionCount, data.previousStateRoot, data.newStateRoot, data.starkProofBytesLength,
      data.verificationTimeMicros, data.verifierCircuitIdentifier, data.isMathematicallySound ? 1 : 0,
      new Date().toISOString()
    )
    .run();
}
