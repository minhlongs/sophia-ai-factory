/**
 * @file hyper-stark-senate.ts
 * @layer seed/types
 * @description Seed types for Gate 17: Recursive Hyper-STARK Verifiable Omnistate & Interstellar Constitutional Supreme Senate.
 */

export type HyperStarkProtocol =
  | 'POST_QUANTUM_FRI_512'
  | 'TACHYON_STARK_RECURSIVE'
  | 'MONOLITH_STARK_V4';

export type HyperStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'RECURSION_COMPACTED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface RecursiveHyperStarkSession {
  id?: string;
  sessionRef: string;
  hyperStarkProtocol: HyperStarkProtocol;
  recursionDepth: number;
  leafProofCount: number; // 4,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: HyperStarkSessionStatus;
  isPostQuantumSound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type InterstellarSenateVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface InterstellarJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  rationale?: string;
}

export interface InterstellarSenateArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  senatorCount: number;
  supermajorityThresholdPct: number; // Min 85.0%
  verdict: InterstellarSenateVerdict;
  senatorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface InterstellarConstitutionalInvariant {
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

export interface HyperStarkTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  signature?: string;
}

export interface HyperStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 4,000,000 transactions
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number; // Sub-280 µs
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}
