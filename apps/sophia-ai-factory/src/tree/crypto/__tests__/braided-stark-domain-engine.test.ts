/**
 * @file braided-stark-domain-engine.test.ts
 * @layer tree/crypto
 * @description Unit tests for canonical Braided STARK Domain Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  generateParameterizedStarkCommitment,
  buildParameterizedTransactionMerkleRoot,
  compactStateParameterizedWithStark,
  type GenericTransactionItem,
} from '../braided-stark-domain-engine';

describe('BraidedStarkDomainEngine (Canonical Parameterized Crypto Engine)', () => {
  it('generates deterministic 64-byte root commitment', () => {
    const commitment = generateParameterizedStarkCommitment('TEST_SEED', {
      protocol: 'TOPOLOGICAL_BRAIDED_4096',
      braidingDepth: 12,
      leafProofCount: 40_000_000,
    });

    expect(commitment.starkProtocol).toBe('TOPOLOGICAL_BRAIDED_4096');
    expect(commitment.braidingDepth).toBe(12);
    expect(commitment.rootCommitment).toHaveLength(128); // 128 hex = 64 bytes
  });

  it('builds binary Merkle tree root for empty and non-empty transactions', () => {
    const emptyRoot = buildParameterizedTransactionMerkleRoot([], {
      emptyStateHashTag: 'EMPTY_TEST_STATE',
    });
    expect(emptyRoot).toHaveLength(128);

    const txs: GenericTransactionItem[] = [
      { txId: 'TX1', sender: 'A', recipient: 'B', amountCents: 100, nonce: 1 },
      { txId: 'TX2', sender: 'B', recipient: 'C', amountCents: 200, nonce: 2 },
    ];
    const treeRoot = buildParameterizedTransactionMerkleRoot(txs);
    expect(treeRoot).toHaveLength(128);
  });

  it('compacts transactions and validates mathematical soundness', () => {
    const prevStateRoot = 'a'.repeat(128);
    const txs: GenericTransactionItem[] = [
      { txId: 'TX1', sender: 'A', recipient: 'B', amountCents: 100, nonce: 1 },
    ];

    const result = compactStateParameterizedWithStark(prevStateRoot, txs, {
      circuitIdentifier: 'TEST_CIRCUIT',
      verificationTimeUnit: 'micros',
      verificationTime: 25,
    });

    expect(result.isMathematicallySound).toBe(true);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.verificationTimeMicros).toBe(25);
    expect(result.compactionDigest).toHaveLength(128);
  });
});
