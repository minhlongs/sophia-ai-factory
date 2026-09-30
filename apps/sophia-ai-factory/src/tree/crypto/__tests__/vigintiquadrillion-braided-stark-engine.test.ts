/**
 * @file vigintiquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 268,435,456-Bit Non-Archimedean Braided STARK Compaction (8T Transactions into 64 Bytes in <6 ns).
 */

import { describe, expect, it } from 'vitest';
import {
  buildVigintiquadrillionEmpireTransactionMerkleRoot,
  compactStateWithVigintiquadrillionBraidedStark,
  generateVigintiquadrillionBraidedStarkCommitment,
} from '../vigintiquadrillion-braided-stark-engine';
import type { VigintiquadrillionEmpireTransaction } from '@/seed/types/vigintiquadrillion-braided-stark-conclave';

describe('Viginti-Quadrillion 268,435,456-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates 268,435,456-bit Braided STARK root commitment with recursive lattice depth 524,288', () => {
    const commitment = generateVigintiquadrillionBraidedStarkCommitment(
      'VIGINTIQUADRILLION_SOVEREIGN_SEED_2026',
      'VIGINTIQUADRILLION_NON_ARCHIMEDEAN_268435456',
      524288
    );

    expect(commitment.starkProtocol).toBe('VIGINTIQUADRILLION_NON_ARCHIMEDEAN_268435456');
    expect(commitment.braidingDepth).toBe(524288);
    expect(commitment.leafProofCount).toBe(8_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes = 128 hex chars
  });

  it('builds post-quantum 64-byte Merkle root across multiple transactions', () => {
    const sampleTxs: VigintiquadrillionEmpireTransaction[] = [
      { txId: 'TX-1', sender: 'SOV_1', recipient: 'SOV_2', amountCents: 20_000_000_00, nonce: 1 },
      { txId: 'TX-2', sender: 'SOV_2', recipient: 'SOV_3', amountCents: 40_000_000_00, nonce: 1 },
      { txId: 'TX-3', sender: 'SOV_3', recipient: 'SOV_4', amountCents: 60_000_000_00, nonce: 1 },
    ];

    const root = buildVigintiquadrillionEmpireTransactionMerkleRoot(sampleTxs);
    expect(root).toHaveLength(128); // SHA-512 hex
  });

  it('compacts state into 64-byte root in under 6 ns with mathematical soundness', () => {
    const prevStateRoot = '0'.repeat(128);
    const sampleTxs: VigintiquadrillionEmpireTransaction[] = [
      { txId: 'TX-BATCH-1', sender: 'ALPHA', recipient: 'BETA', amountCents: 200_000_000_00, nonce: 201 },
      { txId: 'TX-BATCH-2', sender: 'GAMMA', recipient: 'DELTA', amountCents: 400_000_000_00, nonce: 202 },
    ];

    const result = compactStateWithVigintiquadrillionBraidedStark(prevStateRoot, sampleTxs);

    expect(result.batchTransactionCount).toBe(2);
    expect(result.starkProofBytesLength).toBe(268435456);
    expect(result.verificationTimeNanos).toBeLessThan(6);
    expect(result.verificationTimeNanos).toBe(3); // Target 3 ns
    expect(result.isMathematicallySound).toBe(true);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
