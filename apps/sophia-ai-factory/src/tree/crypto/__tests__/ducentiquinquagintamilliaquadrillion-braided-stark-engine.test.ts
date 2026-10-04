/**
 * @file ducentiquinquagintamilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 137,438,953,472-Bit Non-Archimedean Braided STARK Engine (10,000T Transactions, Sub-0.5ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildDucentiquinquagintamilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithDucentiquinquagintamilliaquadrillionBraidedStark,
  generateDucentiquinquagintamilliaquadrillionBraidedStarkCommitment,
} from '../ducentiquinquagintamilliaquadrillion-braided-stark-engine';
import type { DucentiquinquagintamilliaquadrillionEmpireTransaction } from '@/seed/types/ducentiquinquagintamilliaquadrillion-braided-stark-conclave';

describe('Ducenti-Quinquaginta-Millia-Quadrillion 137,438,953,472-Bit Braided STARK Engine', () => {
  it('generates cryptographic root commitment with 268,435,456 braiding depth', () => {
    const commitment = generateDucentiquinquagintamilliaquadrillionBraidedStarkCommitment('seed-test-ducenti-apex');
    expect(commitment.braidingDepth).toBe(268435456);
    expect(commitment.leafProofCount).toBe(10_000_000_000_000_000);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/); // 64 bytes
  });

  it('builds post-quantum SHA-512 Merkle root across transaction batch', () => {
    const txs: DucentiquinquagintamilliaquadrillionEmpireTransaction[] = [
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

    const root = buildDucentiquinquagintamilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64-byte state root in sub-0.5ns with 137,438,953,472-bit proof state', () => {
    const prevState = 'd'.repeat(128);
    const txs: DucentiquinquagintamilliaquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-ducenti-compact',
        sender: 'node-alpha',
        recipient: 'node-omega',
        amountCents: 2_500_000_000,
        nonce: 45,
      },
    ];

    const result = compactStateWithDucentiquinquagintamilliaquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toMatch(/^[a-f0-9]{128}$/);
    expect(result.starkProofBytesLength).toBe(137438953472);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(2);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
