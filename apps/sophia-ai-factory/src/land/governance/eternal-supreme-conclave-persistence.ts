/**
 * @file eternal-supreme-conclave-persistence.ts
 * @layer land/governance
 * @description D1 persistence helpers and result contracts for Eternal Supreme Conclave actions.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  EternalEmpireDisputeInput,
  EternalEmpireDisputeRuling,
  EternalEmpireInvariantCheckOutput,
} from '@/tree/governance/eternal-supreme-conclave-engine';
import type { InfiniteHolographicStarkCompactionResult } from '@/tree/crypto/infinite-holographic-stark-engine';

export interface EternalSupremeDisputeActionResult {
  success: boolean;
  data?: EternalEmpireDisputeRuling;
  error?: string;
}

export interface InfiniteHolographicCompactionActionResult {
  success: boolean;
  data?: InfiniteHolographicStarkCompactionResult;
  error?: string;
}

export interface EternalEmpireInvariantActionResult {
  success: boolean;
  data?: EternalEmpireInvariantCheckOutput;
  error?: string;
}

export async function insertEternalDisputeRecord(
  db: D1Database,
  input: EternalEmpireDisputeInput,
  data: EternalEmpireDisputeRuling,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO eternal_supreme_conclave_disputes (
         id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
         dispute_value_cents, evidence_sha256, total_jurors, claimant_votes,
         respondent_votes, supermajority_pct, jurors_slashed_count,
         total_slashed_stake_cents, executed_remedy_cents, verdict,
         ruling_hash, ruled_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.disputeCaseRef,
      input.claimantParticipantId,
      input.respondentParticipantId,
      input.disputeValueCents,
      input.evidenceSha256,
      data.totalJurors,
      data.claimantVotes,
      data.respondentVotes,
      data.effectiveSupermajorityPct,
      data.jurorsSlashedCount,
      data.totalSlashedStakeCents,
      data.executedRemedyCents,
      data.verdict,
      data.rulingHash,
      new Date().toISOString(),
    )
    .run();
}

export async function insertInfiniteStarkBatchRecord(
  db: D1Database,
  data: InfiniteHolographicStarkCompactionResult,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO infinite_holographic_stark_batches (
         id, batch_ref, batch_tx_count, previous_state_root,
         new_state_root, proof_bytes_length, verification_time_nanos,
         circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `INF-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      data.batchTransactionCount,
      data.previousStateRoot,
      data.newStateRoot,
      data.starkProofBytesLength,
      data.verificationTimeNanos,
      data.verifierCircuitIdentifier,
      data.isMathematicallySound ? 1 : 0,
      data.compactionDigest,
      new Date().toISOString(),
    )
    .run();
}

export async function upsertEternalInvariantRecord(
  db: D1Database,
  data: EternalEmpireInvariantCheckOutput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO eternal_empire_constitutional_invariants (
         id, article_code, article_title, is_strictly_immutable,
         last_theorem_verified_at, enforcement_circuit_hash
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(article_code) DO UPDATE SET
         last_theorem_verified_at = excluded.last_theorem_verified_at,
         enforcement_circuit_hash = excluded.enforcement_circuit_hash`,
    )
    .bind(
      crypto.randomUUID(),
      data.articleCode,
      `ARTICLE_${data.articleCode}`,
      data.isStrictlyImmutable ? 1 : 0,
      new Date().toISOString(),
      data.verificationHash,
    )
    .run();
}
