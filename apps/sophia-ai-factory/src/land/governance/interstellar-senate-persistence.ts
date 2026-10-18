/**
 * @file interstellar-senate-persistence.ts
 * @layer land/governance
 * @description D1 persistence helpers for Interstellar Supreme Senate arbitration and Hyper-STARK compaction.
 */

import { getD1 } from '@/seed/db/client';
import type {
  InterstellarDisputeInput,
  InterstellarSenateVerdictOutput,
} from '@/tree/governance/interstellar-senate-engine';
import type { HyperStarkCompactionResult } from '@/tree/crypto/hyper-stark-compaction-engine';

export async function persistArbitrationRuling(
  params: InterstellarDisputeInput,
  data: InterstellarSenateVerdictOutput
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO interstellar_senate_arbitrations (
         id, dispute_case_ref, claimant_participant_id, respondent_participant_id,
         dispute_value_cents, contract_stark_root, evidence_sha256, senator_count,
         supermajority_threshold_pct, verdict, senators_slashed_count,
         executed_remedy_cents, resolved_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `senate_disp_${Date.now()}`,
      params.disputeCaseRef,
      params.claimantParticipantId,
      params.respondentParticipantId,
      params.disputeValueCents,
      data.rulingHash,
      params.evidenceSha256,
      data.totalSenators,
      params.supermajorityThresholdPct ?? 85.0,
      data.verdict,
      data.senatorsSlashedCount,
      data.executedRemedyCents,
      data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null
    )
    .run();
}

export async function persistHyperStarkCompactionProof(
  data: HyperStarkCompactionResult
): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const proofRef = `HSTARK_PROOF_${Date.now()}`;
  await db
    .prepare(
      `INSERT INTO hyper_stark_compaction_proofs (
         id, proof_ref, batch_transaction_count, previous_state_root,
         new_state_root, stark_proof_bytes_length, verification_time_micros,
         verifier_circuit_identifier, is_mathematically_sound, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      `hstark_${Date.now()}`,
      proofRef,
      data.batchTransactionCount,
      data.previousStateRoot,
      data.newStateRoot,
      data.starkProofBytesLength,
      data.verificationTimeMicros,
      data.verifierCircuitIdentifier,
      data.isMathematicallySound ? 1 : 0,
      new Date().toISOString()
    )
    .run();
}
