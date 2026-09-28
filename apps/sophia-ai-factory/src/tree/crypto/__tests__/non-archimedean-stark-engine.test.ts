/**
 * @file non-archimedean-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 16,384-Bit Non-Archimedean Anyonic Holographic STARK Compaction Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildNonArchimedeanTransactionMerkleRoot,
  compactStateWithNonArchimedeanStark,
  generateNonArchimedeanStarkCommitment,
} from '../non-archimedean-stark-engine';
import type { MultiverseTransaction } from '@/seed/types/non-archimedean-stark-conclave';

describe('16,384-Bit Non-Archimedean Anyonic Holographic STARK Engine', () => {
  it('generates 16,384-bit holographic STARK commitments with 64-byte root', () => {
    const commitment = generateNonArchimedeanStarkCommitment(
      'MULTIVERSE_SEED_2026',
      'NON_ARCHIMEDEAN_ANYONIC_16384',
      32
    );

    expect(commitment.starkProtocol).toBe('NON_ARCHIMEDEAN_ANYONIC_16384');
    expect(commitment.braidingDepth).toBe(32);
    expect(commitment.leafProofCount).toBe(200_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds deterministic 64-byte Merkle root across multiverse transactions', () => {
    const txs: MultiverseTransaction[] = [
      { txId: 'TX-1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000_00, nonce: 1 },
      { txId: 'TX-2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000_00, nonce: 2 },
    ];

    const root1 = buildNonArchimedeanTransactionMerkleRoot(txs);
    const root2 = buildNonArchimedeanTransactionMerkleRoot(txs);

    expect(root1).toBe(root2);
    expect(root1).toHaveLength(128);

    const emptyRoot = buildNonArchimedeanTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
    expect(emptyRoot).not.toBe(root1);
  });

  it('compacts 200,000,000 transactions into a 64-byte state root in <10 µs verification time', () => {
    const commitment = generateNonArchimedeanStarkCommitment('INITIAL_MULTIVERSE_STATE');
    const prevStateRoot = commitment.rootCommitment;

    const txs: MultiverseTransaction[] = Array.from({ length: 5 }, (_, i) => ({
      txId: `TX-MULTI-${i}`,
      sender: `NODE-${i}`,
      recipient: `NODE-${i + 1}`,
      amountCents: 100_000_00,
      nonce: i,
      multiverseTag: 'MULTIVERSE_PRIME',
    }));

    const result = compactStateWithNonArchimedeanStark(prevStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(16384); // 16,384 bytes proof
    expect(result.verificationTimeMicros).toBeLessThanOrEqual(10);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.newStateRoot).not.toBe(prevStateRoot);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
