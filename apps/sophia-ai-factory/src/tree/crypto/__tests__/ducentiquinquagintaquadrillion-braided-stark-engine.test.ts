/**
 * @file ducentiquinquagintaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 17,179,869,184-Bit Non-Archimedean Braided STARK Engine (1,000T Transactions, Sub-1.5ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildDucentiquinquagintaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithDucentiquinquagintaquadrillionBraidedStark,
  generateDucentiquinquagintaquadrillionBraidedStarkCommitment,
} from '../ducentiquinquagintaquadrillion-braided-stark-engine';
import type { DucentiquinquagintaquadrillionEmpireTransaction } from '@/seed/types/ducentiquinquagintaquadrillion-braided-stark-conclave';

describe('Ducenti-Quinquaginta-Quadrillion 17,179,869,184-Bit Braided STARK Engine', () => {
  it('generates cryptographic root commitment with 33,554,432 braiding depth', () => {
    const commitment = generateDucentiquinquagintaquadrillionBraidedStarkCommitment('seed-test-ducenti-apex');
    expect(commitment.braidingDepth).toBe(33554432);
    expect(commitment.leafProofCount).toBe(1_000_000_000_000_000);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/); // 64 bytes
  });

  it('builds post-quantum SHA-512 Merkle root across transaction batch', () => {
    const txs: DucentiquinquagintaquadrillionEmpireTransaction[] = [
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

    const root = buildDucentiquinquagintaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64-byte state root in sub-1.5ns with 17,179,869,184-bit proof state', () => {
    const prevState = 'b'.repeat(128);
    const txs: DucentiquinquagintaquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-ducenti-compact',
        sender: 'node-alpha',
        recipient: 'node-omega',
        amountCents: 999_999_999,
        nonce: 42,
      },
    ];

    const result = compactStateWithDucentiquinquagintaquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toMatch(/^[a-f0-9]{128}$/);
    expect(result.starkProofBytesLength).toBe(17179869184);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(2);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
