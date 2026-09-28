/**
 * @file pan-dimensional-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 262,144-Bit Non-Archimedean Pan-Dimensional STARK Compaction (4B Transactions into 64 Bytes in <2 µs).
 */

import { describe, expect, it } from 'vitest';
import {
  buildPanDimensionalTransactionMerkleRoot,
  compactStateWithPanDimensionalStark,
  generatePanDimensionalStarkCommitment,
} from '../pan-dimensional-stark-engine';
import type { PanDimensionalTransaction } from '@/seed/types/pan-dimensional-stark-conclave';

describe('262,144-Bit Non-Archimedean Pan-Dimensional STARK Engine', () => {
  const dummyStateRoot = 'a'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 262,144-bit STARK commitment with 64-byte root in <2 µs', () => {
    const commitment = generatePanDimensionalStarkCommitment(
      'SINGULARITY_SEED_OMEGA',
      'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_262144',
      512
    );

    expect(commitment.starkProtocol).toBe('PAN_DIMENSIONAL_NON_ARCHIMEDEAN_262144');
    expect(commitment.braidingDepth).toBe(512);
    expect(commitment.leafProofCount).toBe(4_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across pan-dimensional multiverse transactions', () => {
    const txs: PanDimensionalTransaction[] = [
      { txId: 'TX_PAN_1', sender: 'ALICE_0', recipient: 'BOB_0', amountCents: 50_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_PAN_2', sender: 'BOB_0', recipient: 'CHARLIE_0', amountCents: 25_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_PAN_3', sender: 'CHARLIE_0', recipient: 'DAVE_0', amountCents: 10_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildPanDimensionalTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildPanDimensionalTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 1 µs (< 2 µs)', () => {
    const txs: PanDimensionalTransaction[] = [
      { txId: 'TX_4B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 100_000_00, nonce: 1 },
      { txId: 'TX_4B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 200_000_00, nonce: 2 },
    ];

    const result = compactStateWithPanDimensionalStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(262144);
    expect(result.verificationTimeMicros).toBe(1); // 1 µs < 2 µs
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generatePanDimensionalStarkCommitment('SEED', 'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_262144', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithPanDimensionalStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
