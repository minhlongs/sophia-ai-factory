/**
 * @file braided-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 24: 65,536-Bit Non-Archimedean Braided STARK Omniverse & Omnipresent Supreme Conclave.
 */

export type BraidedStarkProtocol =
  | 'BRAIDED_NON_ARCHIMEDEAN_65536'
  | 'PAN_GALACTIC_STARK_RECURSIVE'
  | 'OMNIPRESENT_STARK_V11';

export type BraidedStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface BraidedStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: BraidedStarkProtocol;
  braidingDepth: number; // e.g. 128
  leafProofCount: number; // 800,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: BraidedStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type OmnipresentConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface OmnipresentJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export interface OmnipresentConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.95%
  verdict: OmnipresentConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface OmnipresentConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface BraidedTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  multiverseTag?: string;
}

export interface BraidedStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number; // Sub-6 µs
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
