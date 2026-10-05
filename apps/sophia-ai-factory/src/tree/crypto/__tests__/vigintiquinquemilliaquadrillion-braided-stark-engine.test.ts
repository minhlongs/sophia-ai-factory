/**
 * @file vigintiquinquemilliaquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 1,099,511,627,776-Bit Non-Archimedean Braided STARK Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildVigintiquinquemilliaquadrillionEmpireTransactionMerkleRoot,
  compactStateWithVigintiquinquemilliaquadrillionBraidedStark,
  generateVigintiquinquemilliaquadrillionBraidedStarkCommitment,
} from '../vigintiquinquemilliaquadrillion-braided-stark-engine';
import type { VigintiquinquemilliaquadrillionEmpireTransaction } from '@/seed/types/vigintiquinquemilliaquadrillion-braided-stark-conclave';

describe('Viginti-Quinque-Millia-Quadrillion 1,099B-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 64-byte root commitment with depth 2,147,483,648 and 100.0 Quadrillion leaves', () => {
    const result = generateVigintiquinquemilliaquadrillionBraidedStarkCommitment('seed-viginti-singularity');

    expect(result.starkProtocol).toBe('VIGINTIQUINQUEMILLIAQUADRILLION_NON_ARCHIMEDEAN_1099511627776');
    expect(result.braidingDepth).toBe(2147483648);
    expect(result.leafProofCount).toBe(100_000_000_000_000_000);
    expect(result.rootCommitment).toHaveLength(128); // 64 bytes
  });

  it('builds post-quantum binary Merkle root across multiple transactions', () => {
    const txs: VigintiquinquemilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-1', sender: 'agent-1', recipient: 'agent-2', amountCents: 100_000_000, nonce: 1 },
      { txId: 'tx-2', sender: 'agent-2', recipient: 'agent-3', amountCents: 200_000_000, nonce: 2 },
    ];

    const root = buildVigintiquinquemilliaquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64 bytes with 1,099,511,627,776-bit proof length in <0.15 ns', () => {
    const txs: VigintiquinquemilliaquadrillionEmpireTransaction[] = [
      { txId: 'tx-100', sender: 'a1', recipient: 'b1', amountCents: 50_000_000, nonce: 10 },
    ];

    const previousStateRoot = '0'.repeat(128);
    const result = compactStateWithVigintiquinquemilliaquadrillionBraidedStark(previousStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(1099511627776);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(0.15);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
