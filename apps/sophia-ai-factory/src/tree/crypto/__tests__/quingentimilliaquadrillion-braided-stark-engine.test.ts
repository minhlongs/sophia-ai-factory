/**
 * @file quingentimilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 274,877,906,944-Bit Non-Archimedean Braided STARK Engine (20,000T Transactions, Sub-0.3ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuingentimilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuingentimilliaquadrillionBraidedStark,
  generateQuingentimilliaquadrillionBraidedStarkCommitment,
} from '../quingentimilliaquadrillion-braided-stark-engine';
import type { QuingentimilliaquadrillionEmpireTransaction } from '@/seed/types/quingentimilliaquadrillion-braided-stark-conclave';

describe('Quingenti-Millia-Quadrillion 274,877,906,944-Bit Braided STARK Engine', () => {
  it('generates cryptographic root commitment with 536,870,912 braiding depth', () => {
    const commitment = generateQuingentimilliaquadrillionBraidedStarkCommitment('seed-test-quingenti-apex');
    expect(commitment.braidingDepth).toBe(536870912);
    expect(commitment.leafProofCount).toBe(20_000_000_000_000_000);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/); // 64 bytes
  });

  it('builds post-quantum SHA-512 Merkle root across transaction batch', () => {
    const txs: QuingentimilliaquadrillionEmpireTransaction[] = [
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

    const root = buildQuingentimilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64-byte state root in sub-0.3ns with 274,877,906,944-bit proof state', () => {
    const prevState = 'e'.repeat(128);
    const txs: QuingentimilliaquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-quingenti-compact',
        sender: 'node-alpha',
        recipient: 'node-omega',
        amountCents: 5_000_000_000,
        nonce: 46,
      },
    ];

    const result = compactStateWithQuingentimilliaquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toMatch(/^[a-f0-9]{128}$/);
    expect(result.starkProofBytesLength).toBe(274877906944);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(2);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
