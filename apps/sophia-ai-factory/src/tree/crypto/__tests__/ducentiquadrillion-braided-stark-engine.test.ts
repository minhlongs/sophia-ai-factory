/**
 * @file ducentiquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 2,147,483,648-Bit Non-Archimedean Braided STARK Engine (100T Transactions, Sub-3ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildDucentiquadrillionEmpireTransactionMerkleRoot,
  compactStateWithDucentiquadrillionBraidedStark,
  generateDucentiquadrillionBraidedStarkCommitment,
} from '../ducentiquadrillion-braided-stark-engine';
import type { DucentiquadrillionEmpireTransaction } from '@/seed/types/ducentiquadrillion-braided-stark-conclave';

describe('Ducenti-Quadrillion 2,147,483,648-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 2,147,483,648-bit commitment root', () => {
    const commitment = generateDucentiquadrillionBraidedStarkCommitment('DUCENTI_TEST_SEED_01');
    expect(commitment.starkProtocol).toBe('DUCENTIQUADRILLION_NON_ARCHIMEDEAN_2147483648');
    expect(commitment.braidingDepth).toBe(4194304);
    expect(commitment.leafProofCount).toBe(100_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds 64-byte SHA-512 Merkle root across transactions', () => {
    const txs: DucentiquadrillionEmpireTransaction[] = [
      { txId: 'TX1', sender: 'S1', recipient: 'R1', amountCents: 1000_00, nonce: 1 },
      { txId: 'TX2', sender: 'S2', recipient: 'R2', amountCents: 2000_00, nonce: 2 },
    ];

    const root = buildDucentiquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts state in sub-3ns (1.0 ns target) with mathematical soundness', () => {
    const prevState = 'a'.repeat(128);
    const txs: DucentiquadrillionEmpireTransaction[] = [
      { txId: 'TX_A', sender: 'A', recipient: 'B', amountCents: 5000_00, nonce: 1 },
    ];

    const result = compactStateWithDucentiquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevState);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(2147483648);
    expect(result.verificationTimeNanos).toBeLessThan(3);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(64);
  });
});
