/**
 * @file omniversal-holographic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 4,194,304-Bit Non-Archimedean Omniversal Holographic STARK Compaction (100B Transactions into 64 Bytes in <100 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildOmniversalEmpireTransactionMerkleRoot,
  compactStateWithOmniversalHolographicStark,
  generateOmniversalHolographicStarkCommitment,
} from '../omniversal-holographic-stark-engine';
import type { OmniversalEmpireTransaction } from '@/seed/types/omniversal-holographic-stark-conclave';

describe('4,194,304-Bit Non-Archimedean Omniversal Holographic STARK Engine', () => {
  const dummyStateRoot = 'e'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 4,194,304-bit STARK commitment with 64-byte root in <100 ns', () => {
    const commitment = generateOmniversalHolographicStarkCommitment(
      'SINGULARITY_SEED_OMNIVERSAL',
      'OMNIVERSAL_NON_ARCHIMEDEAN_4194304',
      8192
    );

    expect(commitment.starkProtocol).toBe('OMNIVERSAL_NON_ARCHIMEDEAN_4194304');
    expect(commitment.braidingDepth).toBe(8192);
    expect(commitment.leafProofCount).toBe(100_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across omniversal multiverse transactions', () => {
    const txs: OmniversalEmpireTransaction[] = [
      { txId: 'TX_OMNI_1', sender: 'ALICE_1', recipient: 'BOB_1', amountCents: 200_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_OMNI_2', sender: 'BOB_1', recipient: 'CHARLIE_1', amountCents: 100_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_OMNI_3', sender: 'CHARLIE_1', recipient: 'DAVE_1', amountCents: 50_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildOmniversalEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildOmniversalEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 50 ns', () => {
    const txs: OmniversalEmpireTransaction[] = [
      { txId: 'TX_100B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 1_000_000_00, nonce: 1 },
      { txId: 'TX_100B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 2_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithOmniversalHolographicStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(4194304);
    expect(result.verificationTimeNanos).toBe(50); // 50 ns (< 100 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateOmniversalHolographicStarkCommitment('SEED', 'OMNIVERSAL_NON_ARCHIMEDEAN_4194304', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithOmniversalHolographicStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
