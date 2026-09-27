/**
 * @file zk-stark-compaction-engine.test.ts
 * @layer tree/crypto
 * @description Unit tests for post-quantum recursive zk-STARK compaction engine.
 */

import { describe, it, expect } from 'vitest';
import {
  generateZkStarkCommitment,
  buildStarkTransactionMerkleRoot,
  compactStateWithZkStark,
} from '../zk-stark-compaction-engine';
import type { StarkTransaction } from '@/seed/types/zk-stark-constitution';

describe('ZkStarkCompactionEngine', () => {
  it('generates post-quantum hash-based FRI/STARK commitments with 64-byte root', () => {
    const commitment = generateZkStarkCommitment('test-seed-42', 'POST_QUANTUM_FRI', 4);
    expect(commitment.starkProtocol).toBe('POST_QUANTUM_FRI');
    expect(commitment.recursionDepth).toBe(4);
    expect(commitment.leafProofCount).toBe(2_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes = 128 hex chars

    expect(() => generateZkStarkCommitment('bad-seed', 'POST_QUANTUM_FRI', 0)).toThrow(
      'Invalid recursion depth: 0'
    );
  });

  it('builds post-quantum Merkle root correctly for empty and populated transaction batches', () => {
    const emptyRoot = buildStarkTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);

    const txs: StarkTransaction[] = [
      {
        txId: 'tx-001',
        sender: 'node-alpha',
        recipient: 'node-beta',
        amountCents: 50_000_000,
        nonce: 1,
        signature: 'sig-001',
      },
      {
        txId: 'tx-002',
        sender: 'node-beta',
        recipient: 'node-gamma',
        amountCents: 25_000_000,
        nonce: 1,
        signature: 'sig-002',
      },
      {
        txId: 'tx-003',
        sender: 'node-gamma',
        recipient: 'node-alpha',
        amountCents: 10_000_000,
        nonce: 1,
        signature: 'sig-003',
      },
    ];

    const merkleRoot = buildStarkTransactionMerkleRoot(txs);
    expect(merkleRoot).toHaveLength(128);
    expect(merkleRoot).not.toBe(emptyRoot);

    // Deterministic verify
    const merkleRoot2 = buildStarkTransactionMerkleRoot(txs);
    expect(merkleRoot2).toBe(merkleRoot);
  });

  it('compacts state into a 64-byte post-quantum root in under 350 microseconds', () => {
    const prevCommitment = generateZkStarkCommitment('genesis-block');
    const txs: StarkTransaction[] = Array.from({ length: 10 }, (_, i) => ({
      txId: `tx-${i}`,
      sender: `agent-${i}`,
      recipient: `agent-${(i + 1) % 10}`,
      amountCents: (i + 1) * 1_000_000,
      nonce: i,
      signature: `sig-${i}`,
    }));

    const compaction = compactStateWithZkStark(prevCommitment.rootCommitment, txs);

    expect(compaction.batchTransactionCount).toBe(10);
    expect(compaction.newStateRoot).toHaveLength(128);
    expect(compaction.newStateRoot).not.toBe(prevCommitment.rootCommitment);
    expect(compaction.starkProofBytesLength).toBe(512);
    expect(compaction.verificationTimeMicros).toBeLessThanOrEqual(350);
    expect(compaction.isMathematicallySound).toBe(true);
    expect(compaction.compactionDigest).toHaveLength(128);
  });
});
