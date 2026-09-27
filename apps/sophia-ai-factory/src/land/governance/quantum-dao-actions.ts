'use server';

/**
 * quantum-dao-actions.ts — Gate 12 Land Layer Server Actions
 * Quantum Identity Registration & Sovereign DAO Voting Actions
 */

import { getD1 } from '@/seed/db/client';
import {
  deriveQuantumKeyPair,
  signWithMlDsa,
  verifyMlDsaSignature,
} from '@/tree/crypto/quantum-lattice-crypto';
import {
  evaluateDaoVoteTally,
  computeVoteMerkleLeaf,
} from '@/tree/governance/sovereign-dao-governance';
import type {
  QuantumAlgorithm,
  SovereignDaoProposal,
  DaoVoteReceipt,
  DaoVoteChoice,
} from '@/seed/types/quantum-dao';

export async function registerQuantumKeyAction(agentDid: string, algorithm: QuantumAlgorithm) {
  try {
    const keyPair = deriveQuantumKeyPair(agentDid, algorithm);
    const db = await getD1();

    const keyId = `qkey_${agentDid.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString();

    if (db) {
      await db
        .prepare(
          `INSERT INTO quantum_identity_keys (
            id, agent_did, algorithm, public_key_hex,
            key_encapsulation_parameter_bytes, security_category, is_revoked, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(agent_did) DO UPDATE SET public_key_hex = excluded.public_key_hex`,
        )
        .bind(
          keyId,
          agentDid,
          algorithm,
          keyPair.publicKeyHex,
          1568,
          keyPair.securityCategory,
          0,
          expiresAt,
        )
        .run();
    }

    return {
      success: true,
      data: {
        keyId,
        publicKeyHex: keyPair.publicKeyHex,
        algorithm,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function castDaoVoteAction(params: {
  proposalId: string;
  voterDid: string;
  weight: number;
  choice: DaoVoteChoice;
  privateKeySeedHex: string;
  publicKeyHex: string;
}) {
  try {
    const payload = `${params.proposalId}:${params.choice}:${params.weight}`;
    const signature = signWithMlDsa(payload, params.privateKeySeedHex);
    const isValid = verifyMlDsaSignature(payload, signature, params.publicKeyHex);

    if (!isValid) {
      return { success: false, error: 'Quantum digital signature verification failed' };
    }

    const merkleLeaf = computeVoteMerkleLeaf({
      proposalId: params.proposalId,
      voterDid: params.voterDid,
      weight: params.weight,
      choice: params.choice,
    });

    const receiptId = `vote_${params.proposalId}_${params.voterDid.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const db = await getD1();

    if (db) {
      await db
        .prepare(
          `INSERT INTO dao_vote_receipts (
            id, proposal_id, voter_did, voting_power_weight,
            vote_choice, quantum_signature_hex, merkle_leaf_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(proposal_id, voter_did) DO UPDATE SET
            voting_power_weight = excluded.voting_power_weight,
            vote_choice = excluded.vote_choice,
            quantum_signature_hex = excluded.quantum_signature_hex`,
        )
        .bind(
          receiptId,
          params.proposalId,
          params.voterDid,
          params.weight,
          params.choice,
          signature,
          merkleLeaf,
        )
        .run();
    }

    return {
      success: true,
      receiptId,
      merkleLeaf,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
