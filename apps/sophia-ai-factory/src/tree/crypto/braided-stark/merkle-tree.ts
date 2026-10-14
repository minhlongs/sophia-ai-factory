/**
 * Parameterized Merkle Tree Construction and Reduction
 *
 * Layer: tree/crypto
 */

import { createHash } from 'node:crypto';
import type { MerkleRootConfig, GenericTransactionItem } from './types';

export function buildMerkleLeaves<T>(
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

export function reduceMerkleLevels<T>(
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

export function finalizeMerkleRoot<T>(
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
