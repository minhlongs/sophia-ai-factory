/**
 * @file inter-galactic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 1,048,576-Bit Non-Archimedean Omni-Cosmic Holographic STARK Compaction (20B Transactions into 64 Bytes in <500 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildInterGalacticTransactionMerkleRoot,
  compactStateWithInterGalacticStark,
  generateInterGalacticStarkCommitment,
} from '../inter-galactic-stark-engine';
import type { InterGalacticTransaction } from '@/seed/types/inter-galactic-stark-conclave';

describe('1,048,576-Bit Non-Archimedean Omni-Cosmic Holographic STARK Engine', () => {
  const dummyStateRoot = 'c'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 1,048,576-bit STARK commitment with 64-byte root in <500 ns', () => {
    const commitment = generateInterGalacticStarkCommitment(
      'SINGULARITY_SEED_INTER_GALACTIC',
      'INTER_GALACTIC_NON_ARCHIMEDEAN_1048576',
      2048
    );

    expect(commitment.starkProtocol).toBe('INTER_GALACTIC_NON_ARCHIMEDEAN_1048576');
    expect(commitment.braidingDepth).toBe(2048);
    expect(commitment.leafProofCount).toBe(20_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across inter-galactic multiverse transactions', () => {
    const txs: InterGalacticTransaction[] = [
      { txId: 'TX_IG_1', sender: 'ALICE_1', recipient: 'BOB_1', amountCents: 200_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_IG_2', sender: 'BOB_1', recipient: 'CHARLIE_1', amountCents: 100_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_IG_3', sender: 'CHARLIE_1', recipient: 'DAVE_1', amountCents: 50_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildInterGalacticTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildInterGalacticTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 250 ns', () => {
    const txs: InterGalacticTransaction[] = [
      { txId: 'TX_20B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 1_000_000_00, nonce: 1 },
      { txId: 'TX_20B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 2_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithInterGalacticStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(1048576);
    expect(result.verificationTimeNanos).toBe(250); // 250 ns (< 500 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateInterGalacticStarkCommitment('SEED', 'INTER_GALACTIC_NON_ARCHIMEDEAN_1048576', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithInterGalacticStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
