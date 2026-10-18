/**
 * SHA-256, Merkle Root, and Subject Pseudonymization Primitives
 *
 * Layer: tree/sovereignty/forgotten
 * @module tree/sovereignty/forgotten/merkle-hash-primitives
 */

import { bytesToHex } from '../cmek-envelope-engine';

/**
 * Computes a SHA-256 hash string for an arbitrary text string.
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bytesToHex(new Uint8Array(buffer));
}

/**
 * Computes a deterministic Merkle Root hash from a list of deleted record IDs.
 */
export async function computeMerkleRoot(recordIds: string[]): Promise<string> {
  if (recordIds.length === 0) {
    return sha256Hex('EMPTY_MANIFEST');
  }

  const sortedUniqueIds = Array.from(new Set(recordIds)).sort();

  let currentLevel: string[] = [];
  for (const id of sortedUniqueIds) {
    const leaf = await sha256Hex(`LEAF:${id}`);
    currentLevel.push(leaf);
  }

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      const parent = await sha256Hex(`NODE:${left}:${right}`);
      nextLevel.push(parent);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

/**
 * Generates an irreversible GDPR/PDPD pseudonym identifier from a subject ID.
 */
export async function generateSubjectPseudonym(subjectId: string): Promise<string> {
  const hash = await sha256Hex(`SUBJECT_SALT_v1:${subjectId}`);
  return `ANON_${hash.slice(0, 16).toUpperCase()}`;
}
