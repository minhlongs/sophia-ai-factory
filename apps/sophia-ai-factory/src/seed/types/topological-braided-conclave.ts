/**
 * @file topological-braided-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 20: 4096-Bit Topological Braided STARK & Pan-Cosmic Constitutional Conclave.
 */

export type BraidedStarkProtocol =
  | 'TOPOLOGICAL_BRAIDED_4096'
  | 'PAN_COSMIC_STARK_RECURSIVE'
  | 'MULTIVERSE_STARK_V7';

export type BraidedStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface TopologicalBraidedStarkSession {
  id?: string;
  sessionRef: string;
  braidedStarkProtocol: BraidedStarkProtocol;
  braidingDepth: number; // e.g. 12
  leafProofCount: number; // 40,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: BraidedStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type PanCosmicConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface PanCosmicJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  dimensionId?: string;
  rationale?: string;
}

export interface PanCosmicConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 98.0%
  verdict: PanCosmicConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface PanCosmicConstitutionalInvariant {
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
  payloadHash: string;
  dimensionTag?: string;
}

export interface BraidedStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 40,000,000
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number; // 4096
  verificationTimeMicros: number; // Sub-30 µs (e.g. 28)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
