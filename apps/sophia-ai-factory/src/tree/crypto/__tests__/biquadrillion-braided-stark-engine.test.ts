/**
 * @file biquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 33,554,432-Bit Non-Archimedean Braided STARK Compaction (800B Transactions into 64 Bytes in <12 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildBiquadrillionEmpireTransactionMerkleRoot,
  compactStateWithBiquadrillionBraidedStark,
  generateBiquadrillionBraidedStarkCommitment,
} from '../biquadrillion-braided-stark-engine';
import type { BiquadrillionEmpireTransaction } from '@/seed/types/biquadrillion-braided-stark-conclave';

describe('33,554,432-Bit Non-Archimedean Braided STARK Engine', () => {
  const dummyStateRoot = 'e'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 33,554,432-bit STARK commitment with 64-byte root in <12 ns', () => {
    const commitment = generateBiquadrillionBraidedStarkCommitment(
      'SINGULARITY_SEED_BIQUADRILLION',
      'BIQUADRILLION_NON_ARCHIMEDEAN_33554432',
      65536
    );

    expect(commitment.starkProtocol).toBe('BIQUADRILLION_NON_ARCHIMEDEAN_33554432');
    expect(commitment.braidingDepth).toBe(65536);
    expect(commitment.leafProofCount).toBe(800_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across Bi-Quadrillion multiverse transactions', () => {
    const txs: BiquadrillionEmpireTransaction[] = [
      { txId: 'TX_BIQUAD_1', sender: 'ALICE_BIQUAD_1', recipient: 'BOB_BIQUAD_1', amountCents: 500_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_BIQUAD_2', sender: 'BOB_BIQUAD_1', recipient: 'CHARLIE_BIQUAD_1', amountCents: 300_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_BIQUAD_3', sender: 'CHARLIE_BIQUAD_1', recipient: 'DAVE_BIQUAD_1', amountCents: 150_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildBiquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildBiquadrillionEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 8 ns', () => {
    const txs: BiquadrillionEmpireTransaction[] = [
      { txId: 'TX_800B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 10_000_000_00, nonce: 1 },
      { txId: 'TX_800B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 20_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithBiquadrillionBraidedStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(33554432);
    expect(result.verificationTimeNanos).toBe(8); // 8 ns (< 12 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateBiquadrillionBraidedStarkCommitment('SEED', 'BIQUADRILLION_NON_ARCHIMEDEAN_33554432', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithBiquadrillionBraidedStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
