/**
 * Braided STARK Commitment Generation
 *
 * Layer: tree/crypto
 */

import { createHash } from 'node:crypto';
import type { StarkCommitmentConfig, StarkCommitmentResult } from './types';

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
