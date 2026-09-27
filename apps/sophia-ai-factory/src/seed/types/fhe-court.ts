/**
 * @file fhe-court.ts
 * @layer seed/types
 * @description Seed types for Gate 13: Fully Homomorphic Encryption (FHE) & Zero-Knowledge Autonomous Judicial Court.
 */

export type FheSchemeType = 'CKKS' | 'TFHE' | 'BFV' | 'BGV';
export type FheWorkloadStatus =
  | 'ENCRYPTED_IN_TRANSIT'
  | 'PROCESSING_HOMOMORPHIC'
  | 'BOOTSTRAPPED'
  | 'EVALUATED_READY'
  | 'CORRUPTED';

export interface FheCiphertextWorkload {
  id: string;
  workloadId: string;
  schemeType: FheSchemeType;
  ciphertextDigestSha256: string;
  polynomialModulusDegree: number;
  currentNoiseBudgetBits: number;
  minNoiseBudgetThreshold: number;
  requiresBootstrapping: boolean;
  status: FheWorkloadStatus;
  executionDurationMs: number;
  createdAt: string;
}

export interface FheBootstrapCircuit {
  id: string;
  circuitHash: string;
  gateDepth: number;
  lutEvaluationsCount: number;
  refreshTimeMs: number;
  isVerified: boolean;
  lastUsedAt: string;
  createdAt: string;
}

export type DisputeCategory =
  | 'SLA_BREACH'
  | 'IP_INFRINGEMENT'
  | 'ESCROW_DEFAULT'
  | 'ORBITAL_DATA_CORRUPTION'
  | 'UNAUTHORIZED_SUBROUTINE';

export type JudicialCaseStatus =
  | 'FILED'
  | 'DISCOVERY'
  | 'JUROR_DELIBERATION'
  | 'VERDICT_RENDERED'
  | 'APPEALED'
  | 'EXECUTED_FINAL';

export interface JudicialDisputeCase {
  id: string;
  caseNumber: string;
  claimantIdentityHash: string;
  respondentIdentityHash: string;
  disputeCategory: DisputeCategory;
  disputedAmountCents: number;
  escrowBondCents: number;
  evidenceMerkleRoot: string;
  assignedJurorCount: number;
  verdictThresholdRatio: number;
  appealWindowExpiresAt: string;
  status: JudicialCaseStatus;
  createdAt: string;
}

export type VerdictOutcome =
  | 'CLAIMANT_FAVORED'
  | 'RESPONDENT_FAVORED'
  | 'SPLIT_SETTLEMENT'
  | 'DISMISSED_WITH_PREJUDICE';

export interface JudicialArbitrationVerdict {
  id: string;
  caseNumber: string;
  verdictOutcome: VerdictOutcome;
  affirmativeVotes: number;
  dissentingVotes: number;
  slashedJurorStakesCents: number;
  disbursedCompensationCents: number;
  zeroKnowledgeProofHash: string;
  formalVerificationPassed: boolean;
  executedAt: string;
  createdAt: string;
}

export interface JurorBallot {
  jurorAddress: string;
  vote: 'AFFIRMATIVE' | 'DISSENTING';
  stakeWeightCents: number;
  zkCommitmentHash: string;
}

export interface FheEvaluationRequest {
  workloadId: string;
  scheme: FheSchemeType;
  encryptedInputs: string[];
  operation: 'VECTOR_DOT_PRODUCT' | 'POLYNOMIAL_REGRESSION' | 'HOMOMORPHIC_ADDITION' | 'RELU_BOOTSTRAP';
  noiseBudgetBits: number;
}

export interface FheEvaluationResult {
  workloadId: string;
  resultCiphertextDigest: string;
  consumedNoiseBits: number;
  remainingNoiseBudgetBits: number;
  bootstrappingTriggered: boolean;
  durationMs: number;
}
