/**
 * @file anyonic-stark-directorate.ts
 * @layer seed/types
 * @description Seed types for Gate 19: Non-Abelian Anyonic Hyper-STARK & Multiverse Constitutional Directorate.
 */

export type AnyonicStarkProtocol =
  | 'NON_ABELIAN_ANYONIC_2048'
  | 'TOPOLOGICAL_BRAID_RECURSIVE'
  | 'MULTIVERSE_STARK_V6';

export type AnyonicStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface NonAbelianHyperStarkSession {
  id?: string;
  sessionRef: string;
  hyperStarkProtocol: AnyonicStarkProtocol;
  braidingDepth: number;
  leafProofCount: number; // 20,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: AnyonicStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type MultiverseDirectorateVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface MultiverseJurorVote {
  directorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  dimensionId?: string;
  rationale?: string;
}

export interface MultiverseDirectorateArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  directorCount: number;
  supermajorityThresholdPct: number; // Min 95.0%
  verdict: MultiverseDirectorateVerdict;
  directorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface MultiverseConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface AnyonicTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  dimensionTag?: string;
  payloadHash: string;
}

export interface AnyonicStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 20,000,000
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number; // 2048
  verificationTimeMicros: number; // Sub-60 µs (e.g. 55)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
