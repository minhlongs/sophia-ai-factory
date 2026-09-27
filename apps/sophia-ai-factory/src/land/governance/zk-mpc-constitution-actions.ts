'use server';

/**
 * @file zk-mpc-constitution-actions.ts
 * @layer land/governance
 * @description Land layer Server Actions for ZK-MPC threshold protocols and Constitutional Amendments.
 */

import { getD1 } from '@/seed/db/client';
import { verifyZkMpcQuorum } from '@/tree/crypto/zk-mpc-threshold-engine';
import { evaluateConstitutionalAmendment } from '@/tree/governance/constitutional-amendment-engine';
import type {
  ZkMpcThresholdSession,
  MpcShareCommitment,
  ConstitutionalAmendmentProposal,
} from '@/seed/types/zk-mpc-constitution';

export interface VerifyMpcSessionActionParams {
  session: ZkMpcThresholdSession;
  commitments: MpcShareCommitment[];
}

export interface VerifyMpcActionResult {
  success: boolean;
  isQuorumSatisfied: boolean;
  stateProofMerkleRoot?: string;
  verifiedCount: number;
  error?: string;
}

export async function verifyZkMpcSessionAction(
  params: VerifyMpcSessionActionParams
): Promise<VerifyMpcActionResult> {
  try {
    const quorum = verifyZkMpcQuorum(params.session, params.commitments);
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO zk_mpc_threshold_sessions (
             id, session_id, protocol_type, total_participants, threshold_quorum,
             session_state, aggregated_public_key_hex, state_proof_merkle_root,
             execution_latency_ms
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(session_id) DO UPDATE SET
             session_state = ?,
             state_proof_merkle_root = ?`
        )
        .bind(
          `mpc_${params.session.sessionId}`,
          params.session.sessionId,
          params.session.protocolType,
          params.session.totalParticipants,
          params.session.thresholdQuorum,
          quorum.isQuorumSatisfied ? 'RECONSTRUCTED_READY' : 'COMMITMENT_PHASE',
          params.session.aggregatedPublicKeyHex,
          quorum.stateProofMerkleRoot,
          params.session.executionLatencyMs,
          quorum.isQuorumSatisfied ? 'RECONSTRUCTED_READY' : 'COMMITMENT_PHASE',
          quorum.stateProofMerkleRoot
        )
        .run();
    }

    return {
      success: true,
      isQuorumSatisfied: quorum.isQuorumSatisfied,
      stateProofMerkleRoot: quorum.stateProofMerkleRoot,
      verifiedCount: quorum.verifiedCount,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, isQuorumSatisfied: false, verifiedCount: 0, error: errorMsg };
  }
}

export interface SubmitAmendmentActionParams {
  proposal: ConstitutionalAmendmentProposal;
  affirmativeWeight: number;
  dissentingWeight: number;
}

export interface SubmitAmendmentActionResult {
  success: boolean;
  status?: string;
  isSupermajorityMet?: boolean;
  timelockEnactmentAt?: string;
  error?: string;
}

export async function submitConstitutionalAmendmentAction(
  params: SubmitAmendmentActionParams
): Promise<SubmitAmendmentActionResult> {
  try {
    const evalResult = evaluateConstitutionalAmendment(
      params.proposal,
      params.affirmativeWeight,
      params.dissentingWeight
    );

    const db = await getD1();
    if (db) {
      await db
        .prepare(
          `INSERT INTO constitutional_amendment_proposals (
             id, article_reference, title, proposed_diff_json,
             sponsoring_sovereign_entity, supermajority_requirement_bps,
             affirmative_voting_power_weight, dissenting_voting_power_weight,
             formal_verification_passed, anti_takeover_guardrail_intact,
             ratification_status, timelock_enactment_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(article_reference) DO UPDATE SET
             affirmative_voting_power_weight = ?,
             dissenting_voting_power_weight = ?,
             ratification_status = ?,
             timelock_enactment_at = ?`
        )
        .bind(
          `const_${params.proposal.articleReference}`,
          params.proposal.articleReference,
          params.proposal.title,
          params.proposal.proposedDiffJson,
          params.proposal.sponsoringSovereignEntity,
          params.proposal.supermajorityRequirementBps,
          params.affirmativeWeight,
          params.dissentingWeight,
          params.proposal.formalVerificationPassed ? 1 : 0,
          evalResult.antiTakeoverGuardrailIntact ? 1 : 0,
          evalResult.ratificationStatus,
          evalResult.timelockEnactmentAt ?? params.proposal.timelockEnactmentAt,
          params.affirmativeWeight,
          params.dissentingWeight,
          evalResult.ratificationStatus,
          evalResult.timelockEnactmentAt ?? params.proposal.timelockEnactmentAt
        )
        .run();
    }

    return {
      success: evalResult.ratificationStatus === 'RATIFIED_INTO_LAW',
      status: evalResult.ratificationStatus,
      isSupermajorityMet: evalResult.isSupermajorityMet,
      timelockEnactmentAt: evalResult.timelockEnactmentAt,
      error: evalResult.rejectionReason,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}
