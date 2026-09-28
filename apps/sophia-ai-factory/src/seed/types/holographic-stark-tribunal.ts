/**
 * @file holographic-stark-tribunal.ts
 * @layer seed/types
 * @description Seed types for Gate 18: Holographic Hyper-STARK Omnistate & Galactic Constitutional High Tribunal.
 */

export type HolographicStarkProtocol =
  | 'POST_QUANTUM_HOLOGRAPHIC_1024'
  | 'FRACTAL_STARK_RECURSIVE'
  | 'OMNI_STARK_V5';

export type HolographicStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'RECURSION_COMPACTED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface HolographicHyperStarkSession {
  id?: string;
  sessionRef: string;
  hyperStarkProtocol: HolographicStarkProtocol;
  recursionDepth: number;
  leafProofCount: number; // 10,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: HolographicStarkSessionStatus;
  isPostQuantumSound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type GalacticTribunalVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface GalacticJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  rationale?: string;
}

export interface GalacticTribunalArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  jurorCount: number;
  supermajorityThresholdPct: number; // Min 90.0%
  verdict: GalacticTribunalVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface GalacticConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface HolographicTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash: string;
}

export interface HolographicStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 10,000,000
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number; // 1024
  verificationTimeMicros: number; // Sub-120 µs (e.g. 115)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
