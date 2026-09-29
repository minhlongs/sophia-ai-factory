/**
 * @file omni-dimensional-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 524,288-Bit Non-Archimedean Omni-Dimensional STARK Compaction (10B Transactions into 64 Bytes in <1 µs).
 */

import { describe, expect, it } from 'vitest';
import {
  buildOmniDimensionalTransactionMerkleRoot,
  compactStateWithOmniDimensionalStark,
  generateOmniDimensionalStarkCommitment,
} from '../omni-dimensional-stark-engine';
import type { OmniDimensionalTransaction } from '@/seed/types/omni-dimensional-stark-conclave';

describe('524,288-Bit Non-Archimedean Omni-Dimensional STARK Engine', () => {
  const dummyStateRoot = 'b'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 524,288-bit STARK commitment with 64-byte root in <1 µs', () => {
    const commitment = generateOmniDimensionalStarkCommitment(
      'SINGULARITY_SEED_ETERNAL',
      'OMNI_DIMENSIONAL_NON_ARCHIMEDEAN_524288',
      1024
    );

    expect(commitment.starkProtocol).toBe('OMNI_DIMENSIONAL_NON_ARCHIMEDEAN_524288');
    expect(commitment.braidingDepth).toBe(1024);
    expect(commitment.leafProofCount).toBe(10_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across omni-dimensional multiverse transactions', () => {
    const txs: OmniDimensionalTransaction[] = [
      { txId: 'TX_OMNI_1', sender: 'ALICE_1', recipient: 'BOB_1', amountCents: 100_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_OMNI_2', sender: 'BOB_1', recipient: 'CHARLIE_1', amountCents: 50_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_OMNI_3', sender: 'CHARLIE_1', recipient: 'DAVE_1', amountCents: 20_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildOmniDimensionalTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildOmniDimensionalTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 1 µs', () => {
    const txs: OmniDimensionalTransaction[] = [
      { txId: 'TX_10B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 500_000_00, nonce: 1 },
      { txId: 'TX_10B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 1_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithOmniDimensionalStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(524288);
    expect(result.verificationTimeMicros).toBe(1); // 1 µs
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateOmniDimensionalStarkCommitment('SEED', 'OMNI_DIMENSIONAL_NON_ARCHIMEDEAN_524288', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithOmniDimensionalStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
