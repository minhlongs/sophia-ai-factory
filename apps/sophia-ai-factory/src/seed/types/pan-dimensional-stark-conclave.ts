/**
 * @file pan-dimensional-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 26: 262,144-Bit Non-Archimedean Pan-Dimensional Holographic STARKs & Pan-Dimensional Supreme Conclave.
 */

export type PanDimensionalStarkProtocol =
  | 'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_262144'
  | 'PAN_COSMIC_STARK_RECURSIVE'
  | 'ABSOLUTE_STARK_V13';

export type PanDimensionalStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface PanDimensionalStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: PanDimensionalStarkProtocol;
  braidingDepth: number; // 512
  leafProofCount: number; // 4,000,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: PanDimensionalStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type PanDimensionalConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface PanDimensionalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export interface PanDimensionalConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.999%
  verdict: PanDimensionalConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface PanDimensionalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface PanDimensionalTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  multiverseTag?: string;
}

export interface PanDimensionalStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number; // Sub-2 µs (1 µs target)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
