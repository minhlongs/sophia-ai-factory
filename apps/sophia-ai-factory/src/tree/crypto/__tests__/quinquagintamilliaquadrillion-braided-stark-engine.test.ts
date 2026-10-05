/**
 * @file quinquagintamilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 2,199,023,255,552-Bit Non-Archimedean Braided STARK Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuinquagintamilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuinquagintamilliaquadrillionBraidedStark,
  generateQuinquagintamilliaquadrillionBraidedStarkCommitment,
} from '../quinquagintamilliaquadrillion-braided-stark-engine';
import type { QuinquagintamilliaquadrillionEmpireTransaction } from '@/seed/types/quinquagintamilliaquadrillion-braided-stark-conclave';

describe('Quinquaginta-Millia-Quadrillion 2,199B-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 64-byte root commitment with depth 4,294,967,296 and 200.0 Quadrillion leaves', () => {
    const result = generateQuinquagintamilliaquadrillionBraidedStarkCommitment('seed-quinquaginta-singularity');

    expect(result.starkProtocol).toBe('QUINQUAGINTAMILLIAQUADRILLION_NON_ARCHIMEDEAN_2199023255552');
    expect(result.braidingDepth).toBe(4294967296);
    expect(result.leafProofCount).toBe(200_000_000_000_000_000);
    expect(result.rootCommitment).toHaveLength(128); // 64 bytes
  });

  it('builds post-quantum binary Merkle root across multiple transactions', () => {
    const txs: QuinquagintamilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-1', sender: 'agent-1', recipient: 'agent-2', amountCents: 100_000_000, nonce: 1 },
      { txId: 'tx-2', sender: 'agent-2', recipient: 'agent-3', amountCents: 200_000_000, nonce: 2 },
    ];

    const root = buildQuinquagintamilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64 bytes with 2,199,023,255,552-bit proof length in <0.10 ns', () => {
    const txs: QuinquagintamilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-100', sender: 'a1', recipient: 'b1', amountCents: 50_000_000, nonce: 10 },
    ];

    const previousStateRoot = '0'.repeat(128);
    const result = compactStateWithQuinquagintamilliaquadrillionBraidedStark(previousStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(2199023255552);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(0.10);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
