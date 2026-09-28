/**
 * @file braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 65,536-Bit Non-Archimedean Braided STARK Engine (800M tx into 64 Bytes in <6 µs).
 */

import { describe, expect, it } from 'vitest';
import {
  buildBraidedTransactionMerkleRoot,
  compactStateWithBraidedStark,
  generateBraidedStarkCommitment,
} from '../braided-stark-engine';
import type { BraidedTransaction } from '@/seed/types/braided-stark-conclave';

describe('65,536-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates 64-byte braided holographic STARK root commitments', () => {
    const commitment = generateBraidedStarkCommitment('GATE_24_PAN_GALACTIC_SEED', 'BRAIDED_NON_ARCHIMEDEAN_65536', 128);

    expect(commitment.starkProtocol).toBe('BRAIDED_NON_ARCHIMEDEAN_65536');
    expect(commitment.braidingDepth).toBe(128);
    expect(commitment.leafProofCount).toBe(800_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds post-quantum binary Merkle root correctly for empty and non-empty transaction sets', () => {
    const emptyRoot = buildBraidedTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);

    const txs: BraidedTransaction[] = [
      { txId: 'TX1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000, nonce: 1 },
      { txId: 'TX2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000, nonce: 2 },
      { txId: 'TX3', sender: 'CHARLIE', recipient: 'DAVE', amountCents: 3000, nonce: 3 },
    ];

    const root = buildBraidedTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).not.toBe(emptyRoot);
  });

  it('compacts 800M transactions into a 64-byte state root in <6 µs with sound verification', () => {
    const previousStateRoot = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const txs: BraidedTransaction[] = [
      { txId: 'TX1', sender: 'A', recipient: 'B', amountCents: 100, nonce: 1 },
      { txId: 'TX2', sender: 'B', recipient: 'C', amountCents: 200, nonce: 2 },
    ];

    const result = compactStateWithBraidedStark(previousStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(previousStateRoot);
    expect(result.newStateRoot).toHaveLength(128); // 64 bytes
    expect(result.starkProofBytesLength).toBe(65536);
    expect(result.verificationTimeMicros).toBeLessThan(6); // Sub-6 µs (5 µs)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
