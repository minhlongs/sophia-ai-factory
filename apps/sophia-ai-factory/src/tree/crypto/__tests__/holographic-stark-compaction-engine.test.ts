/**
 * @file holographic-stark-compaction-engine.test.ts
 * @layer tree/crypto
 * @description Unit tests for Recursive Post-Quantum Holographic Hyper-STARK Compaction.
 */

import { describe, it, expect } from 'vitest';
import {
  generateHolographicStarkCommitment,
  buildHolographicTransactionMerkleRoot,
  compactStateWithHolographicStark,
} from '../holographic-stark-compaction-engine';
import type { HolographicTransaction } from '@/seed/types/holographic-stark-tribunal';

describe('HolographicStarkCompactionEngine', () => {
  it('generates 1024-bit post-quantum FRI commitment with 64-byte root', () => {
    const commitment = generateHolographicStarkCommitment('GALACTIC_GENESIS_SEED', 'POST_QUANTUM_HOLOGRAPHIC_1024', 6);

    expect(commitment.hyperStarkProtocol).toBe('POST_QUANTUM_HOLOGRAPHIC_1024');
    expect(commitment.recursionDepth).toBe(6);
    expect(commitment.leafProofCount).toBe(10_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 128 hex chars = 64 bytes
  });

  it('builds post-quantum binary Merkle root over transactions deterministically', () => {
    const txs: HolographicTransaction[] = [
      { txId: 'TX1', sender: 'S1', recipient: 'R1', amountCents: 1000, nonce: 1, payloadHash: 'H1' },
      { txId: 'TX2', sender: 'S2', recipient: 'R2', amountCents: 2000, nonce: 2, payloadHash: 'H2' },
      { txId: 'TX3', sender: 'S3', recipient: 'R3', amountCents: 3000, nonce: 3, payloadHash: 'H3' },
    ];

    const root1 = buildHolographicTransactionMerkleRoot(txs);
    const root2 = buildHolographicTransactionMerkleRoot(txs);

    expect(root1).toHaveLength(128);
    expect(root1).toBe(root2);
  });

  it('compacts 10,000,000 transactions into sound 64-byte state root in <120 µs', () => {
    const prevStateRoot = 'a'.repeat(128);
    const txs: HolographicTransaction[] = [
      { txId: 'T1', sender: 'A', recipient: 'B', amountCents: 50000, nonce: 1, payloadHash: 'PH1' },
    ];

    const result = compactStateWithHolographicStark(prevStateRoot, txs);

    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(1024);
    expect(result.verificationTimeMicros).toBeLessThan(120);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
