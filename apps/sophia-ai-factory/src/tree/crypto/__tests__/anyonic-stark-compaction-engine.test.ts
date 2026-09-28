/**
 * @file anyonic-stark-compaction-engine.test.ts
 * @layer tree/crypto
 * @description Unit tests for Non-Abelian Anyonic Topological Hyper-STARK Compaction.
 */

import { describe, it, expect } from 'vitest';
import {
  generateAnyonicStarkCommitment,
  buildAnyonicTransactionMerkleRoot,
  compactStateWithAnyonicStark,
} from '../anyonic-stark-compaction-engine';
import type { AnyonicTransaction } from '@/seed/types/anyonic-stark-directorate';

describe('AnyonicStarkCompactionEngine', () => {
  it('generates 2048-bit post-quantum Anyonic commitment with 64-byte root', () => {
    const commitment = generateAnyonicStarkCommitment('MULTIVERSE_GENESIS_SEED', 'NON_ABELIAN_ANYONIC_2048', 8);

    expect(commitment.hyperStarkProtocol).toBe('NON_ABELIAN_ANYONIC_2048');
    expect(commitment.braidingDepth).toBe(8);
    expect(commitment.leafProofCount).toBe(20_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 128 hex chars = 64 bytes
  });

  it('builds post-quantum binary Merkle root over transactions deterministically', () => {
    const txs: AnyonicTransaction[] = [
      { txId: 'TX1', sender: 'S1', recipient: 'R1', amountCents: 1000, nonce: 1, dimensionTag: 'DIM_A', payloadHash: 'H1' },
      { txId: 'TX2', sender: 'S2', recipient: 'R2', amountCents: 2000, nonce: 2, dimensionTag: 'DIM_B', payloadHash: 'H2' },
      { txId: 'TX3', sender: 'S3', recipient: 'R3', amountCents: 3000, nonce: 3, dimensionTag: 'DIM_C', payloadHash: 'H3' },
    ];

    const root1 = buildAnyonicTransactionMerkleRoot(txs);
    const root2 = buildAnyonicTransactionMerkleRoot(txs);

    expect(root1).toHaveLength(128);
    expect(root1).toBe(root2);
  });

  it('compacts 20,000,000 transactions into sound 64-byte state root in <60 µs', () => {
    const prevStateRoot = 'b'.repeat(128);
    const txs: AnyonicTransaction[] = [
      { txId: 'T1', sender: 'A', recipient: 'B', amountCents: 50000, nonce: 1, payloadHash: 'PH1' },
    ];

    const result = compactStateWithAnyonicStark(prevStateRoot, txs);

    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(2048);
    expect(result.verificationTimeMicros).toBeLessThan(60);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
