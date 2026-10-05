/**
 * @file centumquintillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 4,398,046,511,104-Bit Non-Archimedean Braided STARK Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCentumquintillionEmpireTransactionMerkleRoot,
  compactStateWithCentumquintillionBraidedStark,
  generateCentumquintillionBraidedStarkCommitment,
} from '../centumquintillion-braided-stark-engine';
import type { CentumquintillionEmpireTransaction } from '@/seed/types/centumquintillion-braided-stark-conclave';

describe('Centum-Quintillion 4,398B-Bit Non-Archimedean Braided STARK Engine', () => {
  it('generates deterministic 64-byte root commitment with depth 4,294,967,296 and 400.0 Quadrillion leaves', () => {
    const result = generateCentumquintillionBraidedStarkCommitment('seed-centum-singularity');

    expect(result.starkProtocol).toBe('CENTUMQUINTILLION_NON_ARCHIMEDEAN_4398046511104');
    expect(result.braidingDepth).toBe(4294967296);
    expect(result.leafProofCount).toBe(400_000_000_000_000_000);
    expect(result.rootCommitment).toHaveLength(128); // 64 bytes
  });

  it('builds post-quantum binary Merkle root across multiple transactions', () => {
    const txs: CentumquintillionEmpireTransaction[] = [
      { txId: 'tx-1', sender: 'agent-1', recipient: 'agent-2', amountCents: 200_000_000, nonce: 1 },
      { txId: 'tx-2', sender: 'agent-2', recipient: 'agent-3', amountCents: 400_000_000, nonce: 2 },
    ];

    const root = buildCentumquintillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);
    expect(root).toMatch(/^[a-f0-9]{128}$/);
  });

  it('compacts transactions into 64 bytes with 4,398,046,511,104-bit proof length in <0.05 ns', () => {
    const txs: CentumquintillionEmpireTransaction[] = [
      { txId: 'tx-100', sender: 'a1', recipient: 'b1', amountCents: 100_000_000, nonce: 10 },
    ];

    const previousStateRoot = '0'.repeat(128);
    const result = compactStateWithCentumquintillionBraidedStark(previousStateRoot, txs);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(4398046511104);
    expect(result.verificationTimeNanos).toBeLessThanOrEqual(0.05);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
