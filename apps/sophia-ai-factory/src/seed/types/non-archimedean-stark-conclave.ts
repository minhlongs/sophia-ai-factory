/**
 * @file non-archimedean-stark-conclave.ts
 * @layer seed/types
 * @description Seed types for Gate 22: 16,384-Bit Non-Archimedean Anyonic Holographic STARK & Infinite Conclave Council.
 */

export type NonArchimedeanStarkProtocol =
  | 'NON_ARCHIMEDEAN_ANYONIC_16384'
  | 'MULTIVERSE_STARK_RECURSIVE'
  | 'INFINITE_STARK_V9';

export type NonArchimedeanStarkSessionStatus =
  | 'PROVING_ACTIVE'
  | 'TOPOLOGICALLY_BRAIDED'
  | 'VERIFIED_SOUND'
  | 'ABORTED_SOUNDNESS_ERROR';

export interface NonArchimedeanStarkSession {
  id?: string;
  sessionRef: string;
  starkProtocol: NonArchimedeanStarkProtocol;
  braidingDepth: number; // e.g. 32
  leafProofCount: number; // 200,000,000 leaf transactions
  finalRootCommitment: string; // 64 bytes (128 hex chars)
  sessionStatus: NonArchimedeanStarkSessionStatus;
  isTopologicallySound: boolean;
  verifiedAt?: string;
  createdAt?: string;
}

export type InfiniteConclaveVerdict =
  | 'PENDING_EVIDENCE'
  | 'DELIBERATING'
  | 'CLAIMANT_PREVAILS'
  | 'RESPONDENT_PREVAILS'
  | 'DISMISSED_NO_JURISDICTION';

export interface InfiniteJurorVote {
  jurorId: string;
  voteForClaimant: boolean;
  stakeCents: number;
  multiverseShardId?: string;
  rationale?: string;
}

export interface InfiniteConclaveArbitration {
  id?: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractStarkRoot: string;
  evidenceSha256: string;
  conclaveJurorCount: number;
  supermajorityThresholdPct: number; // Min 99.5%
  verdict: InfiniteConclaveVerdict;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt?: string;
  createdAt?: string;
}

export interface InfiniteConstitutionalInvariant {
  id?: string;
  articleCode: string;
  articleTitle: string;
  isStrictlyImmutable: boolean;
  enforcementCircuitHash: string;
  lastTheoremVerifiedAt: string;
  createdAt?: string;
}

export interface MultiverseTransaction {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  payloadHash?: string;
  multiverseTag?: string;
}

export interface NonArchimedeanStarkCompactionProof {
  id?: string;
  proofRef: string;
  batchTransactionCount: number; // 200,000,000
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number; // 16384
  verificationTimeMicros: number; // Sub-10 µs (e.g. 9)
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  verifiedAt: string;
  createdAt?: string;
}
