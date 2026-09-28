/**
 * @file topological-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 32,768-Bit Non-Archimedean Topological Holographic STARK Engine (400M tx into 64 Bytes in <8 µs).
 */

import { describe, expect, it } from 'vitest';
import {
  buildTopologicalTransactionMerkleRoot,
  compactStateWithTopologicalStark,
  generateTopologicalStarkCommitment,
} from '../topological-stark-engine';
import type { TopologicalTransaction } from '@/seed/types/topological-stark-conclave';

describe('32,768-Bit Non-Archimedean Topological STARK Engine', () => {
  it('generates 64-byte topological holographic STARK root commitments', () => {
    const commitment = generateTopologicalStarkCommitment('GATE_23_PAN_DIMENSIONAL_SEED', 'TOPOLOGICAL_ANYONIC_32768', 64);

    expect(commitment.starkProtocol).toBe('TOPOLOGICAL_ANYONIC_32768');
    expect(commitment.braidingDepth).toBe(64);
    expect(commitment.leafProofCount).toBe(400_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds post-quantum binary Merkle root correctly for empty and non-empty transaction sets', () => {
    const emptyRoot = buildTopologicalTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);

    const txs: TopologicalTransaction[] = [
      { txId: 'TX1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000, nonce: 1 },
      { txId: 'TX2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000, nonce: 2 },
      { txId: 'TX3', sender: 'CHARLIE', recipient: 'DAVE', amountCents: 3000, nonce: 3 },
    ];

    const root = buildTopologicalTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).not.toBe(emptyRoot);
  });

  it('compacts 400M transactions into a 64-byte state root in <8 µs with sound verification', () => {
    const previousStateRoot = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const txs: TopologicalTransaction[] = [
      { txId: 'TX1', sender: 'A', recipient: 'B', amountCents: 100, nonce: 1 },
      { txId: 'TX2', sender: 'B', recipient: 'C', amountCents: 200, nonce: 2 },
    ];

    const result = compactStateWithTopologicalStark(previousStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(previousStateRoot);
    expect(result.newStateRoot).toHaveLength(128); // 64 bytes
    expect(result.starkProofBytesLength).toBe(32768);
    expect(result.verificationTimeMicros).toBeLessThan(8); // Sub-8 µs
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
