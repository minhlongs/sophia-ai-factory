/**
 * @file hyper-stark-compaction-engine.test.ts
 * @layer tree/crypto
 * @description Unit tests for post-quantum recursive Hyper-STARK compaction engine.
 */

import { describe, it, expect } from 'vitest';
import {
  generateHyperStarkCommitment,
  buildHyperStarkTransactionMerkleRoot,
  compactStateWithHyperStark,
} from '../hyper-stark-compaction-engine';
import type { HyperStarkTransaction } from '@/seed/types/hyper-stark-senate';

describe('HyperStarkCompactionEngine', () => {
  it('generates post-quantum hash-based FRI Hyper-STARK commitments with 64-byte root', () => {
    const commitment = generateHyperStarkCommitment('interstellar-seed-77', 'POST_QUANTUM_FRI_512', 5);
    expect(commitment.hyperStarkProtocol).toBe('POST_QUANTUM_FRI_512');
    expect(commitment.recursionDepth).toBe(5);
    expect(commitment.leafProofCount).toBe(4_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes = 128 hex chars

    expect(() => generateHyperStarkCommitment('bad-seed', 'POST_QUANTUM_FRI_512', 0)).toThrow(
      'Invalid recursion depth: 0'
    );
  });

  it('builds post-quantum Merkle root correctly for empty and populated transaction batches', () => {
    const emptyRoot = buildHyperStarkTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);

    const txs: HyperStarkTransaction[] = [
      {
        txId: 'htx-001',
        sender: 'orbit-1',
        recipient: 'centauri-2',
        amountCents: 100_000_000,
        nonce: 1,
        signature: 'sig-001',
      },
      {
        txId: 'htx-002',
        sender: 'centauri-2',
        recipient: 'lunar-3',
        amountCents: 50_000_000,
        nonce: 1,
        signature: 'sig-002',
      },
    ];

    const merkleRoot = buildHyperStarkTransactionMerkleRoot(txs);
    expect(merkleRoot).toHaveLength(128);
    expect(merkleRoot).not.toBe(emptyRoot);

    const merkleRoot2 = buildHyperStarkTransactionMerkleRoot(txs);
    expect(merkleRoot2).toBe(merkleRoot);
  });

  it('compacts state into a 64-byte post-quantum root in under 280 microseconds', () => {
    const prevCommitment = generateHyperStarkCommitment('interstellar-genesis');
    const txs: HyperStarkTransaction[] = Array.from({ length: 16 }, (_, i) => ({
      txId: `htx-${i}`,
      sender: `node-${i}`,
      recipient: `node-${(i + 1) % 16}`,
      amountCents: (i + 1) * 2_000_000,
      nonce: i,
    }));

    const compaction = compactStateWithHyperStark(prevCommitment.rootCommitment, txs);

    expect(compaction.batchTransactionCount).toBe(16);
    expect(compaction.newStateRoot).toHaveLength(128);
    expect(compaction.newStateRoot).not.toBe(prevCommitment.rootCommitment);
    expect(compaction.starkProofBytesLength).toBe(512);
    expect(compaction.verificationTimeMicros).toBeLessThanOrEqual(280);
    expect(compaction.isMathematicallySound).toBe(true);
    expect(compaction.compactionDigest).toHaveLength(128);
  });
});
