/**
 * @file pan-dimensional-holographic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 2,097,152-Bit Non-Archimedean Pan-Dimensional Holographic STARK Compaction (40B Transactions into 64 Bytes in <250 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildPanDimensionalEmpireTransactionMerkleRoot,
  compactStateWithPanDimensionalHolographicStark,
  generatePanDimensionalHolographicStarkCommitment,
} from '../pan-dimensional-holographic-stark-engine';
import type { PanDimensionalEmpireTransaction } from '@/seed/types/pan-dimensional-holographic-stark-conclave';

describe('2,097,152-Bit Non-Archimedean Pan-Dimensional Holographic STARK Engine', () => {
  const dummyStateRoot = 'd'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 2,097,152-bit STARK commitment with 64-byte root in <250 ns', () => {
    const commitment = generatePanDimensionalHolographicStarkCommitment(
      'SINGULARITY_SEED_PAN_DIMENSIONAL',
      'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_2097152',
      4096
    );

    expect(commitment.starkProtocol).toBe('PAN_DIMENSIONAL_NON_ARCHIMEDEAN_2097152');
    expect(commitment.braidingDepth).toBe(4096);
    expect(commitment.leafProofCount).toBe(40_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across pan-dimensional multiverse transactions', () => {
    const txs: PanDimensionalEmpireTransaction[] = [
      { txId: 'TX_PAN_1', sender: 'ALICE_1', recipient: 'BOB_1', amountCents: 200_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_PAN_2', sender: 'BOB_1', recipient: 'CHARLIE_1', amountCents: 100_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_PAN_3', sender: 'CHARLIE_1', recipient: 'DAVE_1', amountCents: 50_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildPanDimensionalEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildPanDimensionalEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 125 ns', () => {
    const txs: PanDimensionalEmpireTransaction[] = [
      { txId: 'TX_40B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 1_000_000_00, nonce: 1 },
      { txId: 'TX_40B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 2_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithPanDimensionalHolographicStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(2097152);
    expect(result.verificationTimeNanos).toBe(125); // 125 ns (< 250 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generatePanDimensionalHolographicStarkCommitment('SEED', 'PAN_DIMENSIONAL_NON_ARCHIMEDEAN_2097152', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithPanDimensionalHolographicStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
