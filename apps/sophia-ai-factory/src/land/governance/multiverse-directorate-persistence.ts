/**
 * @file multiverse-directorate-persistence.ts
 * @layer land/governance
 * @description D1 persistence helpers for Multiverse Constitutional Directorate arbitrations and Anyonic STARK compaction proofs.
 */

import { getD1 } from '@/seed/db/client';
import type {
  MultiverseDisputeInput,
  MultiverseDirectorateVerdictOutput,
} from '@/tree/governance/multiverse-directorate-engine';
import type { AnyonicStarkCompactionResult } from '@/tree/crypto/anyonic-stark-compaction-engine';

export async function persistMultiverseArbitration(
  params: MultiverseDisputeInput,
  data: MultiverseDirectorateVerdictOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO multiverse_directorate_arbitrations (
         id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
         dispute_value_cents, contract_stark_root, evidence_sha256, director_count,
         supermajority_threshold_pct, verdict, directors_slashed_count,
         executed_remedy_cents, resolved_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      params.disputeCaseRef,
      params.claimantParticipantId,
      params.respondentParticipantId,
      params.disputeValueCents,
      'CONTRACT_ANYONIC_STARK_ROOT',
      params.evidenceSha256,
      data.totalDirectors,
      params.supermajorityThresholdPct ?? 95.0,
      data.verdict,
      data.directorsSlashedCount,
      data.executedRemedyCents
    )
    .run();
}

export async function persistAnyonicCompactionProof(
  data: AnyonicStarkCompactionResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO anyonic_stark_compaction_proofs (
         id, proof_ref, batch_transaction_count, previous_state_root,
         new_state_root, stark_proof_bytes_length, verification_time_micros,
         verifier_circuit_identifier, is_mathematically_sound, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      `ANYONIC-STARK-${Date.now()}`,
      data.batchTransactionCount,
      data.previousStateRoot,
      data.newStateRoot,
      data.starkProofBytesLength,
      data.verificationTimeMicros,
      data.verifierCircuitIdentifier,
      data.isMathematicallySound ? 1 : 0
    )
    .run();
}
