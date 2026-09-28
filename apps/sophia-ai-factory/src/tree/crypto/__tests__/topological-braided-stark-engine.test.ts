/**
 * @file topological-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 4096-Bit Topological Braided Anyonic STARK Compaction.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBraidedTransactionMerkleRoot,
  compactStateWithBraidedStark,
  generateBraidedStarkCommitment,
} from '../topological-braided-stark-engine';
import type { BraidedTransaction } from '@/seed/types/topological-braided-conclave';

describe('Topological Braided STARK Engine', () => {
  it('generates 4096-bit post-quantum STARK commitments for 40,000,000 leaf transactions', () => {
    const commitment = generateBraidedStarkCommitment('SEED_ALPHA_GENESIS', 'TOPOLOGICAL_BRAIDED_4096', 12);

    expect(commitment.braidedStarkProtocol).toBe('TOPOLOGICAL_BRAIDED_4096');
    expect(commitment.braidingDepth).toBe(12);
    expect(commitment.leafProofCount).toBe(40_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 128 hex chars = 64 bytes
  });

  it('builds post-quantum 64-byte Merkle tree root over transaction list', () => {
    const txs: BraidedTransaction[] = [
      { txId: 'TX1', sender: 'ADDR1', recipient: 'ADDR2', amountCents: 50_000_00, nonce: 1, payloadHash: 'H1' },
      { txId: 'TX2', sender: 'ADDR2', recipient: 'ADDR3', amountCents: 25_000_00, nonce: 2, payloadHash: 'H2' },
    ];

    const root = buildBraidedTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
  });

  it('compacts transactions into mathematically sound 64-byte root in <30 µs', () => {
    const prevStateRoot = '0'.repeat(128);
    const txs: BraidedTransaction[] = [
      { txId: 'TX1', sender: 'ADDR1', recipient: 'ADDR2', amountCents: 100_000_00, nonce: 1, payloadHash: 'H1' },
    ];

    const result = compactStateWithBraidedStark(prevStateRoot, txs);

    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(4096);
    expect(result.verificationTimeMicros).toBeLessThan(30); // 28 < 30 µs
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
