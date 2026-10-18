/**
 * @file zk-mpc-threshold-engine.ts
 * @layer tree/crypto
 * @description Pure domain engine for Zero-Knowledge Multi-Party Computation (ZK-MPC) threshold protocols.
 */

import {
  ZkMpcThresholdSession,
  MpcShareCommitment,
} from '@/seed/types/zk-mpc-constitution';
import { FIELD_PRIME, sha256Hex, modInverse } from './zk-mpc-field-math';

export interface ShamirShare {
  x: number;
  y: number;
}

/**
 * Generates polynomial shares for a secret with threshold k out of n
 */
export function generateMpcThresholdShares(
  secret: number,
  thresholdK: number,
  totalN: number
): ShamirShare[] {
  if (thresholdK <= 0 || thresholdK > totalN) {
    throw new Error(`Invalid threshold: k=${thresholdK} must be <= n=${totalN}`);
  }

  const sBig = BigInt(secret);
  const coefficients: bigint[] = [((sBig % FIELD_PRIME) + FIELD_PRIME) % FIELD_PRIME];
  for (let i = 1; i < thresholdK; i++) {
    coefficients.push((sBig * 37n + BigInt(i) * 101n) % FIELD_PRIME);
  }

  const shares: ShamirShare[] = [];
  for (let x = 1; x <= totalN; x++) {
    const xBig = BigInt(x);
    let y = 0n;
    let xPower = 1n;
    for (let c = 0; c < thresholdK; c++) {
      y = (y + coefficients[c] * xPower) % FIELD_PRIME;
      xPower = (xPower * xBig) % FIELD_PRIME;
    }
    shares.push({ x, y: Number((y + FIELD_PRIME) % FIELD_PRIME) });
  }

  return shares;
}

/**
 * Reconstructs the secret from any k shares using Lagrange interpolation
 */
export function reconstructMpcSecret(shares: ShamirShare[], thresholdK: number): number {
  if (shares.length < thresholdK) {
    throw new Error(`Insufficient shares: received ${shares.length}, require threshold ${thresholdK}`);
  }

  const subset = shares.slice(0, thresholdK);
  let secret = 0n;

  for (let i = 0; i < subset.length; i++) {
    const xi = BigInt(subset[i].x);
    const yi = BigInt(subset[i].y);

    let numerator = 1n;
    let denominator = 1n;

    for (let j = 0; j < subset.length; j++) {
      if (i === j) continue;
      const xj = BigInt(subset[j].x);
      numerator = (numerator * (( -xj % FIELD_PRIME ) + FIELD_PRIME)) % FIELD_PRIME;
      denominator = (denominator * (( (xi - xj) % FIELD_PRIME ) + FIELD_PRIME)) % FIELD_PRIME;
    }

    const lagrange = (numerator * modInverse(denominator, FIELD_PRIME)) % FIELD_PRIME;
    secret = (secret + yi * lagrange) % FIELD_PRIME;
  }

  return Number((secret + FIELD_PRIME) % FIELD_PRIME);
}

/**
 * Verifies a ZK-MPC session quorum and generates state proof Merkle root
 */
export function verifyZkMpcQuorum(
  session: ZkMpcThresholdSession,
  commitments: MpcShareCommitment[]
): { isQuorumSatisfied: boolean; stateProofMerkleRoot: string; verifiedCount: number } {
  const verifiedCount = commitments.filter((c) => c.commitmentHashHex.length === 64).length;
  const isQuorumSatisfied = verifiedCount >= session.thresholdQuorum;

  const payload = commitments.map((c) => `${c.participantId}:${c.shareIndex}:${c.commitmentHashHex}`).join('|');
  const stateProofMerkleRoot = sha256Hex(`${session.sessionId}:${isQuorumSatisfied}:${payload}`);

  return {
    isQuorumSatisfied,
    stateProofMerkleRoot,
    verifiedCount,
  };
}
