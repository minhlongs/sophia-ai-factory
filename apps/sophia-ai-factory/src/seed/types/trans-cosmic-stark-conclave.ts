/**
 * @file trans-cosmic-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 25: 131,072-Bit Non-Archimedean Trans-Cosmic Holographic STARK & Transcendental Supreme Conclave.
 */

export type TransCosmicStarkProtocol =
  | 'TRANS_COSMIC_NON_ARCHIMEDEAN_131072'
  | 'OMNIVERSE_STARK_RECURSIVE'
  | 'TRANSCENDENTAL_STARK_V12';

export type TransCosmicStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface TransCosmicStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: TransCosmicStarkProtocol;
  braidingDepth: number; // e.g. 256
  leafProofCount: number; // 2,000,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: TransCosmicStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type TranscendentalConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface TranscendentalJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export interface TranscendentalConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.99%
  verdict: TranscendentalConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface TranscendentalConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface TransCosmicTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  multiverseTag?: string;
}

export interface TransCosmicStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros: number; // Sub-4 µs (3 µs target)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
