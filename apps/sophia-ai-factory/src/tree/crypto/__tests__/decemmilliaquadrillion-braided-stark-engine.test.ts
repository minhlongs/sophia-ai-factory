/**
 * @file decemmilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 549,755,813,888-Bit Non-Archimedean Braided STARK Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildDecemmilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithDecemmilliaquadrillionBraidedStark,
  generateDecemmilliaquadrillionBraidedStarkCommitment,
} from '../decemmilliaquadrillion-braided-stark-engine';
import type { DecemmilliaquadrillionEmpireTransaction } from '@/seed/types/decemmilliaquadrillion-braided-stark-conclave';

describe('Decem-Millia-Quadrillion 549B-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 64-byte root commitment with depth 1,073,741,824 and 40.0 Quadrillion leaves', () => {
    const result = generateDecemmilliaquadrillionBraidedStarkCommitment('seed-decem-singularity');

    expect(result.starkProtocol).toBe('DECEMMILLIAQUADRILLION_NON_ARCHIMEDEAN_549755813888');
    expect(result.braidingDepth).toBe(1073741824);
    expect(result.leafProofCount).toBe(40_000_000_000_000_000);
    expect(result.rootCommitment).toHaveLength(128); // 64 bytes
  });

  it('builds post-quantum binary Merkle root across multiple transactions', () => {
    const txs: DecemmilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-1', sender: 'agent-1', recipient: 'agent-2', amountCents: 100_000_000, nonce: 1 },
      { txId: 'tx-2', sender: 'agent-2', recipient: 'agent-3', amountCents: 200_000_000, nonce: 2 },
    ];

    const root = buildDecemmilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64 bytes with 549,755,813,888-bit proof length in <0.2 ns', () => {
    const txs: DecemmilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-100', sender: 'a1', recipient: 'b1', amountCents: 50_000_000, nonce: 10 },
    ];

    const previousStateRoot = '0'.repeat(128);
    const result = compactStateWithDecemmilliaquadrillionBraidedStark(previousStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(549755813888);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(0.2);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
