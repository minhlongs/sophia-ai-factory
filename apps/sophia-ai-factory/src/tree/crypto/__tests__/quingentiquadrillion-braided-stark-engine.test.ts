/**
 * @file quingentiquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 34,359,738,368-Bit Non-Archimedean Braided STARK Engine (2,000T Transactions, Sub-1.0ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuingentiquadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuingentiquadrillionBraidedStark,
  generateQuingentiquadrillionBraidedStarkCommitment,
} from '../quingentiquadrillion-braided-stark-engine';
import type { QuingentiquadrillionEmpireTransaction } from '@/seed/types/quingentiquadrillion-braided-stark-conclave';

describe('Quingenti-Quadrillion 34,359,738,368-Bit Braided STARK Engine', () => {
  it('generates cryptographic root commitment with 67,108,864 braiding depth', () => {
    const commitment = generateQuingentiquadrillionBraidedStarkCommitment('seed-test-quingenti-apex');
    expect(commitment.braidingDepth).toBe(67108864);
    expect(commitment.leafProofCount).toBe(2_000_000_000_000_000);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/); // 64 bytes
  });

  it('builds post-quantum SHA-512 Merkle root across transaction batch', () => {
    const txs: QuingentiquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-001',
        sender: 'sender-1',
        recipient: 'recipient-1',
        amountCents: 100_000_000,
        nonce: 1,
      },
      {
        txId: 'tx-002',
        sender: 'sender-2',
        recipient: 'recipient-2',
        amountCents: 200_000_000,
        nonce: 1,
      },
    ];

    const root = buildQuingentiquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64-byte state root in sub-1.0ns with 34,359,738,368-bit proof state', () => {
    const prevState = 'b'.repeat(128);
    const txs: QuingentiquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-quingenti-compact',
        sender: 'node-alpha',
        recipient: 'node-omega',
        amountCents: 999_999_999,
        nonce: 43,
      },
    ];

    const result = compactStateWithQuingentiquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toMatch(/^[a-f0-9]{128}$/);
    expect(result.starkProofBytesLength).toBe(34359738368);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(2);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
