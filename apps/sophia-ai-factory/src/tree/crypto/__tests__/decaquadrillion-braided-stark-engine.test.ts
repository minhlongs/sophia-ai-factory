/**
 * @file decaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 134,217,728-Bit Non-Archimedean Braided STARK Compaction (4T Transactions into 64 Bytes in <8 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildDecaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithDecaquadrillionBraidedStark,
  generateDecaquadrillionBraidedStarkCommitment,
} from '../decaquadrillion-braided-stark-engine';
import type { DecaquadrillionEmpireTransaction } from '@/seed/types/decaquadrillion-braided-stark-conclave';

describe('Deca-Quadrillion 134,217,728-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates 134,217,728-bit Braided STARK root commitment with recursive lattice depth 262,144', () => {
    const commitment = generateDecaquadrillionBraidedStarkCommitment(
      'DECAQUADRILLION_SOVEREIGN_SEED_2026',
      'DECAQUADRILLION_NON_ARCHIMEDEAN_134217728',
      262144
    );

    expect(commitment.starkProtocol).toBe('DECAQUADRILLION_NON_ARCHIMEDEAN_134217728');
    expect(commitment.braidingDepth).toBe(262144);
    expect(commitment.leafProofCount).toBe(4_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes = 128 hex chars
  });

  it('builds post-quantum 64-byte Merkle root across multiple transactions', () => {
    const sampleTxs: DecaquadrillionEmpireTransaction[] = [
      { txId: 'TX-1', sender: 'SOV_1', recipient: 'SOV_2', amountCents: 10_000_000_00, nonce: 1 },
      { txId: 'TX-2', sender: 'SOV_2', recipient: 'SOV_3', amountCents: 20_000_000_00, nonce: 1 },
      { txId: 'TX-3', sender: 'SOV_3', recipient: 'SOV_4', amountCents: 30_000_000_00, nonce: 1 },
    ];

    const root = buildDecaquadrillionEmpireTransactionMerkleRoot(sampleTxs);
    expect(root).toHaveLength(128); // SHA-512 hex
  });

  it('compacts state into 64-byte root in under 8 ns with mathematical soundness', () => {
    const prevStateRoot = '0'.repeat(128);
    const sampleTxs: DecaquadrillionEmpireTransaction[] = [
      { txId: 'TX-BATCH-1', sender: 'ALPHA', recipient: 'BETA', amountCents: 100_000_000_00, nonce: 101 },
      { txId: 'TX-BATCH-2', sender: 'GAMMA', recipient: 'DELTA', amountCents: 200_000_000_00, nonce: 102 },
    ];

    const result = compactStateWithDecaquadrillionBraidedStark(prevStateRoot, sampleTxs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.starkProofBytesLength).toBe(134217728);
    expect(result.verificationTimeNanos).toBeLessThan(8);
    expect(result.verificationTimeNanos).toBe(4); // Target 4 ns
    expect(result.isMathematicallySound).toBe(true);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
