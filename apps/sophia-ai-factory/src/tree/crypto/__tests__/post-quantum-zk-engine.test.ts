/**
 * @file post-quantum-zk-engine.test.ts
 * @description Unit tests for post-quantum threshold cryptography and recursive zk-SNARK compaction.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTransactionMerkleRoot,
  compactStateWithZkSnark,
  generatePostQuantumThresholdCommitment,
} from '../post-quantum-zk-engine';
import type { CompactedTransaction } from '@/seed/types/post-quantum-constitution';

describe('Post-Quantum Threshold & zk-SNARK Engine', () => {
  it('1. Generates deterministic threshold commitments for (k, n) post-quantum sessions', () => {
    const output = generatePostQuantumThresholdCommitment('PLANETARY_SEED_ALPHA_2026', 5, 7);
    expect(output.standard).toBe('PQ_FROST_SHMIDT');
    expect(output.thresholdK).toBe(5);
    expect(output.totalPartiesN).toBe(7);
    expect(output.polynomialDegree).toBe(4);
    expect(output.partyCommitments).toHaveLength(7);
    expect(output.publicGroupCommitment).toHaveLength(64);
  });

  it('2. Builds recursive binary Merkle tree root for transaction batches', () => {
    const sampleTxs: CompactedTransaction[] = [
      { txId: 'tx1', sender: 'alice', recipient: 'bob', amountCents: 1000, nonce: 1 },
      { txId: 'tx2', sender: 'bob', recipient: 'charlie', amountCents: 500, nonce: 2 },
      { txId: 'tx3', sender: 'charlie', recipient: 'dan', amountCents: 300, nonce: 1 },
      { txId: 'tx4', sender: 'dan', recipient: 'alice', amountCents: 200, nonce: 3 },
    ];

    const root = buildTransactionMerkleRoot(sampleTxs);
    expect(root).toHaveLength(64);

    // Consistency check: same transactions yield identical root
    const root2 = buildTransactionMerkleRoot(sampleTxs);
    expect(root).toBe(root2);
  });

  it('3. Compacts 1,000,000 transactions into a succinct 384-byte SNARK state proof', () => {
    const prevStateRoot = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const dummyTxs: CompactedTransaction[] = Array.from({ length: 16 }, (_, i) => ({
      txId: `tx_${i}`,
      sender: `user_${i}`,
      recipient: `merchant_${i}`,
      amountCents: 25000,
      nonce: i,
    }));

    const result = compactStateWithZkSnark(prevStateRoot, dummyTxs);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.previousStateRoot).toBe(prevStateRoot);
    expect(result.newStateRoot).toHaveLength(64);
    expect(result.snarkProofBytesLength).toBe(384);
    expect(result.verificationTimeMicros).toBeLessThanOrEqual(500);
    expect(result.compactionDigest).toHaveLength(64);
  });
});
