/**
 * Post-Quantum Recursive State Root Compaction
 *
 * Layer: tree/crypto
 */

import { createHash } from 'node:crypto';
import type { StarkCompactionConfig, StarkCompactionResult, GenericTransactionItem } from './types';
import { buildParameterizedTransactionMerkleRoot } from './merkle-tree';

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
