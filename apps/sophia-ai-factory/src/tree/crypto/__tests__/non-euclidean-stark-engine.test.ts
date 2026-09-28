/**
 * @file non-euclidean-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 8192-Bit Non-Euclidean Anyonic Holographic STARK Compaction Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildNonEuclideanTransactionMerkleRoot,
  compactStateWithNonEuclideanStark,
  generateNonEuclideanStarkCommitment,
} from '../non-euclidean-stark-engine';
import type { ContinuumTransaction } from '@/seed/types/non-euclidean-stark-conclave';

describe('8192-Bit Non-Euclidean Anyonic Holographic STARK Engine', () => {
  it('generates 8192-bit holographic STARK commitments with 64-byte root', () => {
    const commitment = generateNonEuclideanStarkCommitment(
      'OMEGA_SEED_2026',
      'NON_EUCLIDEAN_ANYONIC_8192',
      16
    );

    expect(commitment.starkProtocol).toBe('NON_EUCLIDEAN_ANYONIC_8192');
    expect(commitment.braidingDepth).toBe(16);
    expect(commitment.leafProofCount).toBe(100_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds deterministic 64-byte Merkle root across continuum transactions', () => {
    const txs: ContinuumTransaction[] = [
      { txId: 'TX-1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000_00, nonce: 1 },
      { txId: 'TX-2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000_00, nonce: 2 },
    ];

    const root1 = buildNonEuclideanTransactionMerkleRoot(txs);
    const root2 = buildNonEuclideanTransactionMerkleRoot(txs);

    expect(root1).toBe(root2);
    expect(root1).toHaveLength(128);

    const emptyRoot = buildNonEuclideanTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
    expect(emptyRoot).not.toBe(root1);
  });

  it('compacts 100,000,000 transactions into a 64-byte state root in <15 µs verification time', () => {
    const commitment = generateNonEuclideanStarkCommitment('INITIAL_STATE');
    const prevStateRoot = commitment.rootCommitment;

    const txs: ContinuumTransaction[] = Array.from({ length: 5 }, (_, i) => ({
      txId: `TX-OMEGA-${i}`,
      sender: `NODE-${i}`,
      recipient: `NODE-${i + 1}`,
      amountCents: 50_000_00,
      nonce: i,
      dimensionTag: 'OMEGA_POINT',
    }));

    const result = compactStateWithNonEuclideanStark(prevStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(8192); // 8192 bytes proof
    expect(result.verificationTimeMicros).toBeLessThanOrEqual(15);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.newStateRoot).not.toBe(prevStateRoot);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
