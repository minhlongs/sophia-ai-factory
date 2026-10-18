/**
 * Cryptographic Merkle Audit Vault: Binary Merkle Tree Builder & Proofs
 *
 * Implements binary Merkle tree construction and O(log N) inclusion proofs.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/tree-builder
 */

import type { MerkleProof } from './types';
import { sha256Hex } from './hasher';
import { verifyMerkleProof } from './proof-verifier';

export { verifyMerkleProof };

/**
 * Build a complete binary Merkle tree from an ordered list of leaf hashes
 */
export async function buildMerkleTree(
  leafHashes: string[]
): Promise<{ rootHash: string; levels: string[][] }> {
  if (leafHashes.length === 0) {
    const emptyRoot = await sha256Hex('EMPTY_PERIOD_GENESIS');
    return { rootHash: emptyRoot, levels: [[emptyRoot]] };
  }

  if (leafHashes.length === 1) {
    return { rootHash: leafHashes[0], levels: [[leafHashes[0]]] };
  }

  const levels: string[][] = [];
  let currentLevel = [...leafHashes];
  levels.push([...currentLevel]);

  while (currentLevel.length > 1) {
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const combined = currentLevel[i] + currentLevel[i + 1];
      const parentHash = await sha256Hex(combined);
      nextLevel.push(parentHash);
    }

    levels.push([...nextLevel]);
    currentLevel = nextLevel;
  }

  return { rootHash: currentLevel[0], levels };
}

/**
 * Generate an O(log N) Merkle inclusion proof for a leaf at targetIndex
 */
export async function generateMerkleProof(
  leafHashes: string[],
  targetIndex: number
): Promise<MerkleProof> {
  if (leafHashes.length === 0 || targetIndex < 0 || targetIndex >= leafHashes.length) {
    throw new Error(`Invalid leaf index ${targetIndex} for total leaves ${leafHashes.length}`);
  }

  const { rootHash } = await buildMerkleTree(leafHashes);
  const targetLeaf = leafHashes[targetIndex];

  if (leafHashes.length === 1) {
    return {
      rootHash,
      leafHash: targetLeaf,
      index: targetIndex,
      totalLeaves: 1,
      proofHashes: [],
      proofDirections: [],
      isValid: true,
    };
  }

  const proofHashes: string[] = [];
  const proofDirections: ('left' | 'right')[] = [];

  let currentLevel = [...leafHashes];
  let currentIndex = targetIndex;

  while (currentLevel.length > 1) {
    if (currentLevel.length % 2 !== 0) {
      currentLevel.push(currentLevel[currentLevel.length - 1]);
    }

    const isEven = currentIndex % 2 === 0;
    const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

    proofHashes.push(currentLevel[siblingIndex]);
    proofDirections.push(isEven ? 'right' : 'left');

    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const parent = await sha256Hex(currentLevel[i] + currentLevel[i + 1]);
      nextLevel.push(parent);
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    rootHash,
    leafHash: targetLeaf,
    index: targetIndex,
    totalLeaves: leafHashes.length,
    proofHashes,
    proofDirections,
    isValid: true,
  };
}
