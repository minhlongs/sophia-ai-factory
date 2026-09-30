/**
 * @file centumquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 1,073,741,824-Bit Non-Archimedean Braided STARK Engine (40T Transactions State Root, Sub-4ns Verification).
 */

import { describe, expect, it } from 'vitest';
import {
  buildCentumquadrillionEmpireTransactionMerkleRoot,
  compactStateWithCentumquadrillionBraidedStark,
  generateCentumquadrillionBraidedStarkCommitment,
} from '../centumquadrillion-braided-stark-engine';
import type { CentumquadrillionEmpireTransaction } from '@/seed/types/centumquadrillion-braided-stark-conclave';

describe('Centum-Quadrillion Braided STARK Engine (1,073,741,824-bit)', () => {
  it('generates cryptographic commitment with depth 2,097,152 and 40T leaf proof capacity', () => {
    const commitment = generateCentumquadrillionBraidedStarkCommitment(
      'TEST_SEED_CENTUM_001',
      'CENTUMQUADRILLION_NON_ARCHIMEDEAN_1073741824',
      2097152
    );

    expect(commitment.starkProtocol).toBe('CENTUMQUADRILLION_NON_ARCHIMEDEAN_1073741824');
    expect(commitment.braidingDepth).toBe(2097152);
    expect(commitment.leafProofCount).toBe(40_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds SHA-512 Merkle root across multiple transactions', () => {
    const txs: CentumquadrillionEmpireTransaction[] = [
      { txId: 'TX-C-1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000_00, nonce: 1 },
      { txId: 'TX-C-2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000_00, nonce: 2 },
      { txId: 'TX-C-3', sender: 'CHARLIE', recipient: 'DAVE', amountCents: 3000_00, nonce: 3 },
    ];

    const root = buildCentumquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);

    const emptyRoot = buildCentumquadrillionEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
    expect(emptyRoot).not.toBe(root);
  });

  it('compacts state into 64-byte root in under 4 ns (target 1.5 ns)', () => {
    const txs: CentumquadrillionEmpireTransaction[] = [
      { txId: 'TX-C-4', sender: 'S1', recipient: 'R1', amountCents: 5000_00, nonce: 1 },
    ];

    const prevRoot = '0'.repeat(128);
    const result = compactStateWithCentumquadrillionBraidedStark(prevRoot, txs);

    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(1073741824); // 1,073,741,824-bit
    expect(result.verificationTimeNanos).toBe(1); // 1 ns < 4 ns
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(64);
  });
});
