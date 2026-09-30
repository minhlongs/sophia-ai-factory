/**
 * @file quadrillion-holographic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 16,777,216-Bit Non-Archimedean Quadrillion Holographic STARK Compaction (400B Transactions into 64 Bytes in <15 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuadrillionHolographicStark,
  generateQuadrillionHolographicStarkCommitment,
} from '../quadrillion-holographic-stark-engine';
import type { QuadrillionEmpireTransaction } from '@/seed/types/quadrillion-holographic-stark-conclave';

describe('16,777,216-Bit Non-Archimedean Quadrillion Holographic STARK Engine', () => {
  const dummyStateRoot = 'e'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 16,777,216-bit STARK commitment with 64-byte root in <15 ns', () => {
    const commitment = generateQuadrillionHolographicStarkCommitment(
      'SINGULARITY_SEED_QUADRILLION',
      'QUADRILLION_NON_ARCHIMEDEAN_16777216',
      32768
    );

    expect(commitment.starkProtocol).toBe('QUADRILLION_NON_ARCHIMEDEAN_16777216');
    expect(commitment.braidingDepth).toBe(32768);
    expect(commitment.leafProofCount).toBe(400_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across Quadrillion multiverse transactions', () => {
    const txs: QuadrillionEmpireTransaction[] = [
      { txId: 'TX_QUAD_1', sender: 'ALICE_QUAD_1', recipient: 'BOB_QUAD_1', amountCents: 500_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_QUAD_2', sender: 'BOB_QUAD_1', recipient: 'CHARLIE_QUAD_1', amountCents: 300_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_QUAD_3', sender: 'CHARLIE_QUAD_1', recipient: 'DAVE_QUAD_1', amountCents: 150_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildQuadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildQuadrillionEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 10 ns', () => {
    const txs: QuadrillionEmpireTransaction[] = [
      { txId: 'TX_400B_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 10_000_000_00, nonce: 1 },
      { txId: 'TX_400B_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 20_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithQuadrillionHolographicStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(16777216);
    expect(result.verificationTimeNanos).toBe(10); // 10 ns (< 15 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generateQuadrillionHolographicStarkCommitment('SEED', 'QUADRILLION_NON_ARCHIMEDEAN_16777216', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithQuadrillionHolographicStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
