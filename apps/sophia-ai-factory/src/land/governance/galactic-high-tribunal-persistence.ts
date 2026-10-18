/**
 * @file galactic-high-tribunal-persistence.ts
 * @layer land/governance
 * @description D1 persistence helpers for Galactic High Tribunal arbitrations and Holographic STARK compaction proofs.
 */

import { getD1 } from '@/seed/db/client';
import type {
  GalacticDisputeInput,
  GalacticTribunalVerdictOutput,
} from '@/tree/governance/galactic-high-tribunal-engine';
import type { HolographicStarkCompactionResult } from '@/tree/crypto/holographic-stark-compaction-engine';

export async function persistGalacticArbitration(
  params: GalacticDisputeInput,
  data: GalacticTribunalVerdictOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO galactic_tribunal_arbitrations (
         id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
         dispute_value_cents, contract_stark_root, evidence_sha256, juror_count,
         supermajority_threshold_pct, verdict, jurors_slashed_count,
         executed_remedy_cents, resolved_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      params.disputeCaseRef,
      params.claimantParticipantId,
      params.respondentParticipantId,
      params.disputeValueCents,
      'CONTRACT_HOLOGRAPHIC_STARK_ROOT',
      params.evidenceSha256,
      data.totalJurors,
      params.supermajorityThresholdPct ?? 90.0,
      data.verdict,
      data.jurorsSlashedCount,
      data.executedRemedyCents
    )
    .run();
}

export async function persistHolographicCompactionProof(
  data: HolographicStarkCompactionResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO holographic_stark_compaction_proofs (
         id, proof_ref, batch_transaction_count, previous_state_root,
         new_state_root, stark_proof_bytes_length, verification_time_micros,
         verifier_circuit_identifier, is_mathematically_sound, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      crypto.randomUUID(),
      `HOLO-STARK-${Date.now()}`,
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
