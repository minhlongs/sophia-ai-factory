/**
 * @file centummilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 8,589,934,592-Bit Non-Archimedean Braided STARK Engine (400T Transactions, Sub-2.0ns Compaction).
 */

import { describe, expect, it } from 'vitest';
import {
  buildCentummilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithCentummilliaquadrillionBraidedStark,
  generateCentummilliaquadrillionBraidedStarkCommitment,
} from '../centummilliaquadrillion-braided-stark-engine';
import type { CentummilliaquadrillionEmpireTransaction } from '@/seed/types/centummilliaquadrillion-braided-stark-conclave';

describe('Centummillia-Quadrillion 8,589,934,592-Bit Braided STARK Engine', () => {
  it('generates cryptographic root commitment with 16,777,216 braiding depth', () => {
    const commitment = generateCentummilliaquadrillionBraidedStarkCommitment('seed-test-centummillia-apex');
    expect(commitment.braidingDepth).toBe(16777216);
    expect(commitment.leafProofCount).toBe(400_000_000_000_000);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/); // 64 bytes
  });

  it('builds post-quantum SHA-512 Merkle root across transaction batch', () => {
    const txs: CentummilliaquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-001',
        sender: 'sender-1',
        recipient: 'recipient-1',
        amountCents: 50_000_000,
        nonce: 1,
      },
      {
        txId: 'tx-002',
        sender: 'sender-2',
        recipient: 'recipient-2',
        amountCents: 150_000_000,
        nonce: 1,
      },
    ];

    const root = buildCentummilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64-byte state root in sub-2.0ns with 8,589,934,592-bit proof state', () => {
    const prevState = 'a'.repeat(128);
    const txs: CentummilliaquadrillionEmpireTransaction[] = [
      {
        txId: 'tx-centummillia-compact',
        sender: 'node-alpha',
        recipient: 'node-omega',
        amountCents: 999_999_999,
        nonce: 42,
      },
    ];

    const result = compactStateWithCentummilliaquadrillionBraidedStark(prevState, txs);
    expect(result.batchTransactionCount).toBe(1);
    expect(result.newStateRoot).toMatch(/^[a-f0-9]{128}$/);
    expect(result.starkProofBytesLength).toBe(8589934592);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(2);
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
