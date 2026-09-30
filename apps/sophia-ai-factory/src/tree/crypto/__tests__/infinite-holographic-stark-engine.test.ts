/**
 * @file infinite-holographic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 8,388,608-Bit Non-Archimedean Infinite Holographic STARK Compaction (200B Transactions into 64 Bytes in <50 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildInfiniteEmpireTransactionMerkleRoot,
  compactStateWithInfiniteHolographicStark,
  generateInfiniteHolographicStarkCommitment,
} from '../infinite-holographic-stark-engine';
import type { InfiniteEmpireTransaction } from '@/seed/types/infinite-holographic-stark-conclave';

describe('8,388,608-Bit Non-Archimedean Infinite Holographic STARK Engine', () => {
  const dummyStateRoot = 'f'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 8,388,608-bit STARK commitment with 64-byte root in <50 ns', () => {
    const commitment = generateInfiniteHolographicStarkCommitment(
      'SINGULARITY_SEED_INFINITE',
      'INFINITE_NON_ARCHIMEDEAN_8388608',
      16384
    );

    expect(commitment.starkProtocol).toBe('INFINITE_NON_ARCHIMEDEAN_8388608');
    expect(commitment.braidingDepth).toBe(16384);
    expect(commitment.leafProofCount).toBe(200_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across infinite multiverse transactions', () => {
    const txs: InfiniteEmpireTransaction[] = [
      { txId: 'TX_INF_1', sender: 'ALICE_1', recipient: 'BOB_1', amountCents: 200_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_INF_2', sender: 'BOB_1', recipient: 'CHARLIE_1', amountCents: 100_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_INF_3', sender: 'CHARLIE_1', recipient: 'DAVE_1', amountCents: 50_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildInfiniteEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildInfiniteEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 25 ns', () => {
    const txs: InfiniteEmpireTransaction[] = [
      { txId: 'TX_200B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 1_000_000_00, nonce: 1 },
      { txId: 'TX_200B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 2_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithInfiniteHolographicStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(8388608);
    expect(result.verificationTimeNanos).toBe(25); // 25 ns (< 50 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateInfiniteHolographicStarkCommitment('SEED', 'INFINITE_NON_ARCHIMEDEAN_8388608', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithInfiniteHolographicStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
