/**
 * @file zk-stark-constitution.ts
 * @layer seed/types
 * @description Seed types for Gate 16: Recursive zk-STARK Verifiable Statehood & Universal Supreme Constitutional Court.
 */

export type StarkProtocol = 'POST_QUANTUM_FRI' | 'ETH_STARK_RECURSIVE' | 'PLONKY3_MONOLITH';

export type StarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'RECURSION_COMPACTED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface RecursiveZkStarkSession {
  id: string;
  sessionRef: string;
  starkProtocol: StarkProtocol;
  recursionDepth: number;
  leafProofCount: number; // 2,000,000 proofs
  finalRootCommitment: string;
  sessionStatus: StarkSessionStatus;
  isPostQuantumSound: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export type UniversalCourtVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface UniversalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  rationale?: string;
}

export interface UniversalCourtArbitration {
  id: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  jurorCount: number;
  supermajorityThresholdPct: number; // min 80.0%
  verdict: UniversalCourtVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt: string;
}

export interface UniversalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash?: string;
  enactedTimestampMicros?: number;
  sha512EnactmentProof?: string;
  lastTheoremVerifiedAt?: string;
  createdAt?: string;
}

export interface StarkTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  signature?: string;
}

export interface ZkStarkCompactionProof {
  id: string;
  proofRef: string;
  batchTransactionCount: number; // 2,000,000 transactions
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt: string;
}
