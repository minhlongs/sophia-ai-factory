import { describe, it, expect } from 'vitest';
import {
  generateMpcThresholdShares,
  reconstructMpcSecret,
  verifyZkMpcQuorum,
} from '../zk-mpc-threshold-engine';
import type {
  ZkMpcThresholdSession,
  MpcShareCommitment,
} from '@/seed/types/zk-mpc-constitution';

describe('ZK-MPC Threshold Protocols Engine Unit Tests', () => {
  it('generates n shares and reconstructs secret from any subset of k shares', () => {
    const secret = 123456789;
    const thresholdK = 4;
    const totalN = 7;

    const shares = generateMpcThresholdShares(secret, thresholdK, totalN);
    expect(shares.length).toBe(7);

    // Any 4 shares can reconstruct the secret
    const subset1 = [shares[0], shares[1], shares[2], shares[3]];
    const reconstructed1 = reconstructMpcSecret(subset1, thresholdK);
    expect(reconstructed1).toBe(secret);

    // Any other 4 shares (e.g. 3, 4, 5, 6) reconstruct the same secret
    const subset2 = [shares[2], shares[3], shares[4], shares[6]];
    const reconstructed2 = reconstructMpcSecret(subset2, thresholdK);
    expect(reconstructed2).toBe(secret);
  });

  it('fails reconstruction if fewer than threshold k shares are provided', () => {
    const secret = 42;
    const thresholdK = 5;
    const totalN = 9;

    const shares = generateMpcThresholdShares(secret, thresholdK, totalN);
    // Only 3 shares provided (< 5)
    expect(() => reconstructMpcSecret(shares.slice(0, 3), thresholdK)).toThrowError(
      /Insufficient shares: received 3, require threshold 5/
    );
  });

  it('verifies quorum and generates state proof Merkle root', () => {
    const session: ZkMpcThresholdSession = {
      id: 'session_01',
      sessionId: 'MPC_SESSION_ALPHA',
      protocolType: 'BGW_ACTIVE',
      totalParticipants: 9,
      thresholdQuorum: 6,
      sessionState: 'COMMITMENT_PHASE',
      aggregatedPublicKeyHex: '04'.padEnd(130, '0'),
      stateProofMerkleRoot: '',
      executionLatencyMs: 25,
      createdAt: '2026-09-27T00:00:00Z',
    };

    const validCommitments: MpcShareCommitment[] = Array.from({ length: 6 }, (_, i) => ({
      participantId: `node_${i + 1}`,
      shareIndex: i + 1,
      commitmentHashHex: (i + 1).toString(16).repeat(64).slice(0, 64),
      zkProofPayload: `zk_proof_${i + 1}`,
    }));

    const result = verifyZkMpcQuorum(session, validCommitments);
    expect(result.isQuorumSatisfied).toBe(true);
    expect(result.verifiedCount).toBe(6);
    expect(result.stateProofMerkleRoot).toMatch(/^[a-f0-9]{64}$/);

    // Sub-quorum case (4 commitments < 6 required)
    const subQuorumResult = verifyZkMpcQuorum(session, validCommitments.slice(0, 4));
    expect(subQuorumResult.isQuorumSatisfied).toBe(false);
    expect(subQuorumResult.verifiedCount).toBe(4);
  });
});
