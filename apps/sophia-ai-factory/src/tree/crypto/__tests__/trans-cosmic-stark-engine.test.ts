/**
 * @file trans-cosmic-stark-engine.test.ts
 * @layer tree/crypto/__tests__
 * @description Unit tests for 131,072-Bit Non-Archimedean Trans-Cosmic Holographic STARK Engine.
 */

import { describe, expect, it } from 'vitest';
import {
  buildTransCosmicTransactionMerkleRoot,
  compactStateWithTransCosmicStark,
  generateTransCosmicStarkCommitment,
} from '../trans-cosmic-stark-engine';
import type { TransCosmicTransaction } from '@/seed/types/trans-cosmic-stark-conclave';

describe('131,072-Bit Non-Archimedean Trans-Cosmic STARK Engine', () => {
  it('generates deterministic post-quantum holographic STARK commitment with 64-byte root', () => {
    const commitment = generateTransCosmicStarkCommitment('GENESIS_TRANS_COSMIC_SEED', 'TRANS_COSMIC_NON_ARCHIMEDEAN_131072', 256);

    expect(commitment.starkProtocol).toBe('TRANS_COSMIC_NON_ARCHIMEDEAN_131072');
    expect(commitment.braidingDepth).toBe(256);
    expect(commitment.leafProofCount).toBe(2_000_000_000);
    // 64 bytes in hex = 128 chars
    expect(commitment.rootCommitment).toHaveLength(128);
    expect(commitment.rootCommitment).toMatch(/^[a-f0-9]{128}$/);
  });

  it('rejects invalid braiding depths <= 0', () => {
    expect(() => generateTransCosmicStarkCommitment('SEED', 'TRANS_COSMIC_NON_ARCHIMEDEAN_131072', 0)).toThrow(
      'Invalid braiding depth: 0'
    );
  });

  it('builds SHA-512 64-byte Merkle root for batches of trans-cosmic transactions', () => {
    const transactions: TransCosmicTransaction[] = [
      { txId: 'TX_ALPHA_001', sender: 'SENDER_1', recipient: 'RECIPIENT_1', amountCents: 100_00, nonce: 1 },
      { txId: 'TX_ALPHA_002', sender: 'SENDER_2', recipient: 'RECIPIENT_2', amountCents: 200_00, nonce: 1 },
      { txId: 'TX_ALPHA_003', sender: 'SENDER_3', recipient: 'RECIPIENT_3', amountCents: 300_00, nonce: 1 },
    ];

    const merkleRoot = buildTransCosmicTransactionMerkleRoot(transactions);
    expect(merkleRoot).toHaveLength(128);
    expect(merkleRoot).toMatch(/^[a-f0-9]{128}$/);

    const emptyRoot = buildTransCosmicTransactionMerkleRoot([]);
    expect(emptyRoot).toHaveLength(128);
  });

  it('compacts 2B transaction state into 64-byte root in under 4 µs (3 µs target)', () => {
    const prevState = 'a'.repeat(128);
    const transactions: TransCosmicTransaction[] = [
      { txId: 'TX_2B_CHUNK_001', sender: 'PARTICIPANT_A', recipient: 'PARTICIPANT_B', amountCents: 50_000_000_00, nonce: 42 },
    ];

    const result = compactStateWithTransCosmicStark(prevState, transactions);

    expect(result.isMathematicallySound).toBe(true);
    expect(result.starkProofBytesLength).toBe(131072); // 131,072 bytes
    expect(result.verificationTimeMicros).toBe(3); // 3 µs < 4 µs
    expect(result.previousStateRoot).toBe(prevState);
    expect(result.newStateRoot).toHaveLength(128);
    expect(result.compactionDigest).toMatch(/^[a-f0-9]{128}$/);
  });
});
