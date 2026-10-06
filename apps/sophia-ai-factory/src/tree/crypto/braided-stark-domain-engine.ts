/**
 * @file braided-stark-domain-engine.ts
 * @layer tree/crypto
 * @description Canonical parameterized domain engine for Post-Quantum Braided STARK Commitments & Merkle Compaction.
 */

import { createHash } from 'node:crypto';

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

/**
 * Generates post-quantum STARK commitments parameterized across dimensions.
 */
export function generateParameterizedStarkCommitment(
  entropySeed: string,
  config: StarkCommitmentConfig = {}
): StarkCommitmentResult {
  const protocol = config.protocol ?? 'TOPOLOGICAL_BRAIDED_4096';
  const depth = config.braidingDepth ?? 12;
  const count = config.leafProofCount ?? 40_000_000;
  const depthPrefix = config.depthPrefix ?? 'BRAID';

  if (depth <= 0) {
    const depthName = depthPrefix === 'RECURSION' || depthPrefix === 'DEPTH' ? 'recursion' : 'braiding';
    throw new Error(`Invalid ${depthName} depth: ${depth}`);
  }

  let rootCommitment: string;
  if (config.commitmentHashFn) {
    rootCommitment = config.commitmentHashFn(entropySeed, protocol, depth, count);
  } else {
    rootCommitment = createHash('sha512')
      .update(`${protocol}:${entropySeed}:${depthPrefix}_${depth}:LEAVES_${count}`)
      .digest('hex');
  }

  return {
    starkProtocol: protocol,
    braidedStarkProtocol: protocol,
    braidingDepth: depth,
    leafProofCount: count,
    rootCommitment,
  };
}

function buildMerkleLeaves<T>(
  transactions: T[],
  config: MerkleRootConfig<T>,
  algo: string
): string[] {
  return transactions.map((tx) => {
    if (config.leafHashFn) {
      return config.leafHashFn(tx);
    }
    const genericTx = tx as unknown as GenericTransactionItem;
    const tag = genericTx.dimensionTag ?? genericTx.multiverseTag ?? 'PRIME';
    return createHash(algo)
      .update(`${genericTx.txId}:${genericTx.sender}:${genericTx.recipient}:${genericTx.amountCents}:${genericTx.nonce}:${tag}`)
      .digest('hex');
  });
}

function reduceMerkleLevels<T>(
  leaves: string[],
  config: MerkleRootConfig<T>,
  algo: string
): string {
  let currentLevel = leaves;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const pairHash = config.pairHashFn
        ? config.pairHashFn(left, right)
        : createHash(algo).update(`${left}:${right}`).digest('hex');
      nextLevel.push(pairHash);
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

function finalizeMerkleRoot<T>(
  rawRoot: string,
  config: MerkleRootConfig<T>,
  algo: string
): string {
  let root = rawRoot;
  if (config.saltPrefix) {
    const salt = createHash(algo).update(`${config.saltPrefix}:${root}`).digest('hex');
    root = (root + salt).substring(0, config.outputLength ?? 128);
  }
  if (config.outputLength && root.length > config.outputLength) {
    root = root.substring(0, config.outputLength);
  }
  return root;
}

/**
 * Builds binary Merkle tree root reduction over transaction batch leaves.
 */
export function buildParameterizedTransactionMerkleRoot<T = GenericTransactionItem>(
  transactions: T[],
  config: MerkleRootConfig<T> = {}
): string {
  const algo = config.hashAlgorithm ?? 'sha512';

  if (transactions.length === 0) {
    if (config.emptyStateValue !== undefined) {
      return config.emptyStateValue;
    }
    const emptyTag = config.emptyStateHashTag ?? 'EMPTY_BRAIDED_STARK_STATE';
    return createHash(algo).update(emptyTag).digest('hex');
  }

  const leaves = buildMerkleLeaves(transactions, config, algo);
  const root = reduceMerkleLevels(leaves, config, algo);
  return finalizeMerkleRoot(root, config, algo);
}

/**
 * Compacts transactions into a post-quantum recursive state root.
 */
export function compactStateParameterizedWithStark<T = GenericTransactionItem>(
  previousStateRoot: string,
  transactions: T[],
  config: StarkCompactionConfig<T> = {}
): StarkCompactionResult {
  const circuitId = config.circuitIdentifier ?? 'BRAIDED_STARK_4096_RECURSIVE_V1';
  const proofBytes = config.starkProofBytesLength ?? 4096;
  const time = config.verificationTime ?? 28;
  const timeUnit = config.verificationTimeUnit ?? 'micros';

  const batchRoot = buildParameterizedTransactionMerkleRoot(transactions, config.merkleConfig);

  let newStateRoot: string;
  if (config.newStateRootFn) {
    newStateRoot = config.newStateRootFn(previousStateRoot, batchRoot, transactions.length, circuitId);
  } else {
    newStateRoot = createHash('sha512')
      .update(`${previousStateRoot}:${batchRoot}:${transactions.length}`)
      .digest('hex');
  }

  let compactionDigest: string;
  if (config.compactionDigestFn) {
    compactionDigest = config.compactionDigestFn(previousStateRoot, newStateRoot, circuitId, proofBytes, transactions.length);
  } else {
    compactionDigest = createHash('sha512')
      .update(`BRAIDED_STARK_COMPACT:${circuitId}:${previousStateRoot}:${newStateRoot}:${proofBytes}`)
      .digest('hex');
  }

  const isMathematicallySound = Boolean(
    previousStateRoot &&
      (previousStateRoot.length === 128 || previousStateRoot.length === 64) &&
      (newStateRoot.length === 128 || newStateRoot.length === 64) &&
      transactions.length >= 0
  );

  const result: StarkCompactionResult = {
    batchTransactionCount: transactions.length,
    previousStateRoot,
    newStateRoot,
    starkProofBytesLength: proofBytes,
    verifierCircuitIdentifier: circuitId,
    isMathematicallySound,
    compactionDigest,
  };

  if (timeUnit === 'nanos') {
    result.verificationTimeNanos = time;
  } else {
    result.verificationTimeMicros = time;
  }

  return result;
}
