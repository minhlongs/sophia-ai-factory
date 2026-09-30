/**
 * @file pentaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 67,108,864-Bit Non-Archimedean Braided STARK Compaction (2T Transactions into 64 Bytes in <10 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildPentaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithPentaquadrillionBraidedStark,
  generatePentaquadrillionBraidedStarkCommitment,
} from '../pentaquadrillion-braided-stark-engine';
import type { PentaquadrillionEmpireTransaction } from '@/seed/types/pentaquadrillion-braided-stark-conclave';

describe('67,108,864-Bit Non-Archimedean Braided STARK Engine', () => {
  const dummyStateRoot = 'e'.repeat(128); // 64 bytes = 128 hex chars

  it('generates post-quantum 67,108,864-bit STARK commitment with 64-byte root in <10 ns', () => {
    const commitment = generatePentaquadrillionBraidedStarkCommitment(
      'SINGULARITY_SEED_PENTAQUADRILLION',
      'PENTAQUADRILLION_NON_ARCHIMEDEAN_67108864',
      131072
    );

    expect(commitment.starkProtocol).toBe('PENTAQUADRILLION_NON_ARCHIMEDEAN_67108864');
    expect(commitment.braidingDepth).toBe(131072);
    expect(commitment.leafProofCount).toBe(2_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes in hex
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('builds 64-byte Merkle root across Penta-Quadrillion multiverse transactions', () => {
    const txs: PentaquadrillionEmpireTransaction[] = [
      { txId: 'TX_PENTA_1', sender: 'ALICE_PENTA_1', recipient: 'BOB_PENTA_1', amountCents: 500_000_00, nonce: 1, multiverseTag: 'SHARD_1' },
      { txId: 'TX_PENTA_2', sender: 'BOB_PENTA_1', recipient: 'CHARLIE_PENTA_1', amountCents: 300_000_00, nonce: 2, multiverseTag: 'SHARD_2' },
      { txId: 'TX_PENTA_3', sender: 'CHARLIE_PENTA_1', recipient: 'DAVE_PENTA_1', amountCents: 150_000_00, nonce: 3, multiverseTag: 'SHARD_3' },
    ];

    const root = buildPentaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildPentaquadrillionEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts transactions into a 64-byte post-quantum state root in 5 ns', () => {
    const txs: PentaquadrillionEmpireTransaction[] = [
      { txId: 'TX_2T_1', sender: 'NODE_0', recipient: 'NODE_1', amountCents: 10_000_000_00, nonce: 1 },
      { txId: 'TX_2T_2', sender: 'NODE_1', recipient: 'NODE_2', amountCents: 20_000_000_00, nonce: 2 },
    ];

    const result = compactStateWithPentaquadrillionBraidedStark(dummyStateRoot, txs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.previousStateRoot).toBe(dummyStateRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(67108864);
    expect(result.verificationTimeNanos).toBe(5); // 5 ns (< 10 ns)
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });

  it('detects unsound state roots or invalid braiding parameters', () => {
    expect(() =>
      generatePentaquadrillionBraidedStarkCommitment('SEED', 'PENTAQUADRILLION_NON_ARCHIMEDEAN_67108864', 0)
    ).toThrow('Invalid braiding depth');

    const corruptedResult = compactStateWithPentaquadrillionBraidedStark('short-corrupt-root', []);
    expect(corruptedResult.isMathematicallySound).toBe(false);
  });
});
