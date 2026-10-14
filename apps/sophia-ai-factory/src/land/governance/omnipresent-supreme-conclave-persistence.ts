/**
 * @file omnipresent-supreme-conclave-persistence.ts
 * @layer land/governance
 * @description D1 persistence helpers and result contracts for Omnipresent Supreme Conclave actions.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  OmnipresentEmpireDisputeInput,
  OmnipresentEmpireDisputeRuling,
  OmnipresentEmpireInvariantCheckOutput,
} from '@/tree/governance/omnipresent-supreme-conclave-engine';
import type { OmniversalHolographicStarkCompactionResult } from '@/tree/crypto/omniversal-holographic-stark-engine';

export interface OmnipresentSupremeDisputeActionResult {
  success: boolean;
  data?: OmnipresentEmpireDisputeRuling;
  error?: string;
}

export interface OmniversalHolographicCompactionActionResult {
  success: boolean;
  data?: OmniversalHolographicStarkCompactionResult;
  error?: string;
}

export interface OmnipresentEmpireInvariantActionResult {
  success: boolean;
  data?: OmnipresentEmpireInvariantCheckOutput;
  error?: string;
}

export async function insertOmnipresentDisputeRecord(
  db: D1Database,
  input: OmnipresentEmpireDisputeInput,
  data: OmnipresentEmpireDisputeRuling,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO omnipresent_supreme_conclave_disputes (
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

export async function insertOmniversalStarkBatchRecord(
  db: D1Database,
  data: OmniversalHolographicStarkCompactionResult,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO omniversal_holographic_stark_batches (
         id, batch_ref, batch_tx_count, previous_state_root,
         new_state_root, proof_bytes_length, verification_time_nanos,
         circuit_identifier, is_mathematically_sound, stark_digest, compacted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      `OMNI-STARK-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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

export async function upsertOmnipresentInvariantRecord(
  db: D1Database,
  data: OmnipresentEmpireInvariantCheckOutput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO omnipresent_empire_constitutional_invariants (
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
