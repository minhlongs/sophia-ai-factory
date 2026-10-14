/**
 * Braided STARK and Merkle Compaction Types
 *
 * Layer: tree/crypto
 */

export interface StarkCommitmentConfig {
  protocol?: string;
  braidingDepth?: number;
  leafProofCount?: number;
  depthPrefix?: string;
  commitmentHashFn?: (seed: string, protocol: string, depth: number, count: number) => string;
}

export interface StarkCommitmentResult {
  starkProtocol: string;
  braidedStarkProtocol?: string;
  braidingDepth: number;
  leafProofCount: number;
  rootCommitment: string;
}

export interface GenericTransactionItem {
  txId: string;
  sender: string;
  recipient: string;
  amountCents: number;
  nonce: number;
  dimensionTag?: string;
  multiverseTag?: string;
  payloadHash?: string;
}

export interface MerkleRootConfig<T = GenericTransactionItem> {
  hashAlgorithm?: 'sha256' | 'sha512';
  emptyStateValue?: string;
  emptyStateHashTag?: string;
  leafHashFn?: (tx: T) => string;
  pairHashFn?: (left: string, right: string) => string;
  saltPrefix?: string;
  outputLength?: number;
}

export interface StarkCompactionConfig<T = GenericTransactionItem> {
  circuitIdentifier?: string;
  starkProofBytesLength?: number;
  verificationTime?: number;
  verificationTimeUnit?: 'micros' | 'nanos';
  merkleConfig?: MerkleRootConfig<T>;
  newStateRootFn?: (prevStateRoot: string, batchRoot: string, count: number, circuitId: string) => string;
  compactionDigestFn?: (prevStateRoot: string, newStateRoot: string, circuitId: string, proofBytes: number, count: number) => string;
}

export interface StarkCompactionResult {
  batchTransactionCount: number;
  previousStateRoot: string;
  newStateRoot: string;
  starkProofBytesLength: number;
  verificationTimeMicros?: number;
  verificationTimeNanos?: number;
  verifierCircuitIdentifier: string;
  isMathematicallySound: boolean;
  compactionDigest: string;
}
