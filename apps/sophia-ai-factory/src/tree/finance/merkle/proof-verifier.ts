/**
 * Cryptographic Merkle Audit Vault: Proof Verification
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/finance/merkle/proof-verifier
 */

import type { MerkleProof } from './types';
import { sha256Hex } from './hasher';

/**
 * Verify a Merkle inclusion proof against an expected root hash
 */
export async function verifyMerkleProof(
  proof: MerkleProof,
  expectedRoot: string,
): Promise<boolean> {
  if (proof.totalLeaves === 1) {
    return proof.leafHash === expectedRoot;
  }

  let currentHash = proof.leafHash;
  for (let i = 0; i < proof.proofHashes.length; i++) {
    const sibling = proof.proofHashes[i];
    const direction = proof.proofDirections[i];
    const combined =
      direction === 'right' ? currentHash + sibling : sibling + currentHash;
    currentHash = await sha256Hex(combined);
  }

  return currentHash === expectedRoot;
}
