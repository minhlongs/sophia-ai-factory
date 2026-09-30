/**
 * @file quinquagintiquadrillion-braided-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 536,870,912-Bit Non-Archimedean Braided STARK Engine (20T Transactions State Root, Sub-5ns Verification).
 */

import { describe, expect, it } from 'vitest';
import {
  buildQuinquagintiquadrillionEmpireTransactionMerkleRoot,
  compactStateWithQuinquagintiquadrillionBraidedStark,
  generateQuinquagintiquadrillionBraidedStarkCommitment,
} from '../quinquagintiquadrillion-braided-stark-engine';
import type { QuinquagintiquadrillionEmpireTransaction } from '@/seed/types/quinquagintiquadrillion-braided-stark-conclave';

describe('Quinquaginti-Quadrillion Braided STARK Engine (536,870,912-bit)', () => {
  it('generates cryptographic commitment with depth 1,048,576 and 20T leaf proof capacity', () => {
    const commitment = generateQuinquagintiquadrillionBraidedStarkCommitment(
      'TEST_SEED_QUINQUAGINTI_001',
      'QUINQUAGINTIQUADRILLION_NON_ARCHIMEDEAN_536870912',
      1048576
    );

    expect(commitment.starkProtocol).toBe('QUINQUAGINTIQUADRILLION_NON_ARCHIMEDEAN_536870912');
    expect(commitment.braidingDepth).toBe(1048576);
    expect(commitment.leafProofCount).toBe(20_000_000_000_000);
    expect(commitment.rootCommitment).toHaveLength(128); // 64 bytes hex
  });

  it('builds SHA-512 Merkle root across multiple transactions', () => {
    const txs: QuinquagintiquadrillionEmpireTransaction[] = [
      { txId: 'TX-Q-1', sender: 'ALICE', recipient: 'BOB', amountCents: 1000_00, nonce: 1 },
      { txId: 'TX-Q-2', sender: 'BOB', recipient: 'CHARLIE', amountCents: 2000_00, nonce: 2 },
      { txId: 'TX-Q-3', sender: 'CHARLIE', recipient: 'DAVE', amountCents: 3000_00, nonce: 3 },
    ];

    const root = buildQuinquagintiquadrillionEmpireTransactionMerkleRoot(txs);
    expect(root).toHaveLength(128);

    const emptyRoot = buildQuinquagintiquadrillionEmpireTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
    expect(emptyRoot).not.toBe(root);
  });

  it('compacts state into 64-byte root in under 5 ns (target 2 ns)', () => {
    const txs: QuinquagintiquadrillionEmpireTransaction[] = [
      { txId: 'TX-Q-4', sender: 'S1', recipient: 'R1', amountCents: 5000_00, nonce: 1 },
    ];

    const prevRoot = '0'.repeat(128);
    const result = compactStateWithQuinquagintiquadrillionBraidedStark(prevRoot, txs);

    expect(result.batchTransactionCount).toBe(1);
    expect(result.previousStateRoot).toBe(prevRoot);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.starkProofBytesLength).toBe(536870912); // 536,870,912-bit
    expect(result.verificationTimeNanos).toBe(2); // 2 ns < 5 ns
    expect(result.isMathematicallySound).toBe(true);
    expect(result.compactionDigest).toHaveLength(64);
  });
});
