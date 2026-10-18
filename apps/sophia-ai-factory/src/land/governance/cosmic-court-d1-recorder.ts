/**
 * @file cosmic-court-d1-recorder.ts
 * @layer land/governance
 * @description Shared D1 persistence helper for Cosmic, Planetary, Universal, and Conclave Server Actions.
 */

import { getD1 } from '@/seed/db/client';

export interface CosmicConclaveDisputePersistInput {
  tableName:
    | 'inter_galactic_conclave_disputes'
    | 'omni_dimensional_conclave_disputes'
    | 'pan_dimensional_supreme_conclave_disputes';
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

export async function recordCosmicConclaveDispute(p: CosmicConclaveDisputePersistInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, evidence_sha256, total_jurors, claimant_votes, respondent_votes, supermajority_pct, jurors_slashed_count, total_slashed_stake_cents, executed_remedy_cents, verdict, ruling_hash, ruled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(), p.disputeCaseRef, p.claimantParticipantId, p.respondentParticipantId,
      p.disputeValueCents, p.evidenceSha256, p.totalJurors, p.claimantVotes, p.respondentVotes,
      p.effectiveSupermajorityPct, p.jurorsSlashedCount, p.totalSlashedStakeCents,
      p.executedRemedyCents, p.verdict, p.rulingHash, new Date().toISOString()
    )
    .run();
}

export interface CosmicStarkBatchPersistInput {
  tableName:
    | 'inter_galactic_stark_batches'
    | 'omni_dimensional_stark_batches'
    | 'pan_dimensional_holographic_stark_batches';
  batchRefPrefix: string;
  newStateColumn: 'newStateRoot' | 'new_state_root';
  timeColumn: 'verification_time_nanos' | 'verification_time_micros';
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTime: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  compactionDigest: string;
}

export async function recordCosmicStarkBatch(p: CosmicStarkBatchPersistInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  const batchRef = `${p.batchRefPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, batch_ref, batch_tx_count, previous_state_root, ${p.newStateColumn}, proof_bytes_length, ${p.timeColumn}, circuit_identifier, is_mathematically_sound, stark_digest, compacted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(), batchRef, p.batchTransactionCount, p.previousStateRoot, p.newStateRoot,
      p.starkProofBytesLength, p.verificationTime, p.verifierCircuitIdentifier,
      p.isMathematicallySound ? 1 : 0, p.compactionDigest, new Date().toISOString()
    )
    .run();
}

export interface CourtCompactionProofPersistInput {
  tableName: 'zk_state_compaction_proofs' | 'zk_stark_compaction_proofs' | 'braided_stark_compaction_proofs';
  id: string;
  proofRef: string;
  proofLengthColumn: 'snark_proof_bytes_length' | 'stark_proof_bytes_length';
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  proofBytesLength: number;
  verificationTimeMicros: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  includeVerifiedAt?: boolean;
}

export async function recordCourtCompactionProof(p: CourtCompactionProofPersistInput): Promise<void> {
  const db = await getD1();
  if (!db) return;
  if (p.includeVerifiedAt) {
    await db
      .prepare(
        `INSERT INTO ${p.tableName} (id, proof_ref, batch_transaction_count, previous_state_root, new_state_root, ${p.proofLengthColumn}, verification_time_micros, verifier_circuit_identifier, is_mathematically_sound, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        p.id, p.proofRef, p.batchTransactionCount, p.previousStateRoot, p.newStateRoot,
        p.proofBytesLength, p.verificationTimeMicros, p.verifierCircuitIdentifier,
        p.isMathematicallySound ? 1 : 0, new Date().toISOString()
      )
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, proof_ref, batch_transaction_count, previous_state_root, new_state_root, ${p.proofLengthColumn}, verification_time_micros, verifier_circuit_identifier, is_mathematically_sound) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      p.id, p.proofRef, p.batchTransactionCount, p.previousStateRoot, p.newStateRoot,
      p.proofBytesLength, p.verificationTimeMicros, p.verifierCircuitIdentifier,
      p.isMathematicallySound ? 1 : 0
    )
    .run();
}
