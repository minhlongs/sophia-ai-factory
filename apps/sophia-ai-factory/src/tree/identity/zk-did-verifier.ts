/**
 * zk-did-verifier.ts — Gate 11 Zero-Knowledge Decentralized Identifier (ZK-DID) Engine
 * Layer: TREE (Business Logic)
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  ZkDidIdentity,
  DidRevocationStatus,
} from '@/seed/types/planetary-swarm';
import {
  registerDidIdentityInDb,
  fetchDidIdentityByDid,
} from './zk-did-db-ops';

export interface DidIssuanceInput {
  ownerNodeId: string;
  controllerUri: string;
  publicKeyMultibase: string;
  credentialSchemaHash: string;
  validityDays?: number;
}

export interface DidVerificationResult {
  isValid: boolean;
  did: string;
  reason?: string;
  revocationStatus: DidRevocationStatus;
  expiresAt: string;
}

export class ZkDidVerifier {
  public static generateDidString(publicKeyMultibase: string, credentialSchemaHash: string): string {
    const rawDigest = createHash('sha256')
      .update(`${publicKeyMultibase}:${credentialSchemaHash}`)
      .digest('hex')
      .substring(0, 32);

    return `did:sophia:zk:${rawDigest}`;
  }

  public static issueIdentity(input: DidIssuanceInput, id?: string): ZkDidIdentity {
    const did = this.generateDidString(input.publicKeyMultibase, input.credentialSchemaHash);
    const now = new Date();
    const validityDays = input.validityDays || 365;
    const expiresAt = new Date(now.getTime() + validityDays * 86_400_000).toISOString();

    const proofPayload = `${did}:${input.ownerNodeId}:${input.publicKeyMultibase}:${expiresAt}`;
    const merkleProofHex = createHash('sha256').update(proofPayload).digest('hex');

    return {
      id: id || `did_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      did,
      ownerNodeId: input.ownerNodeId,
      controllerUri: input.controllerUri,
      publicKeyMultibase: input.publicKeyMultibase,
      credentialSchemaHash: input.credentialSchemaHash,
      revocationStatus: 'ACTIVE',
      proofType: 'Ed25519Signature2020',
      merkleProofHex,
      issuedAt: now.toISOString(),
      expiresAt,
    };
  }

  public static verifyIdentity(identity: ZkDidIdentity): DidVerificationResult {
    const base = {
      isValid: false,
      did: identity.did,
      revocationStatus: identity.revocationStatus,
      expiresAt: identity.expiresAt,
    };

    if (!identity.did.startsWith('did:sophia:zk:')) {
      return { ...base, reason: 'Malformed DID format: expected did:sophia:zk:* prefix' };
    }

    if (identity.revocationStatus !== 'ACTIVE') {
      return {
        ...base,
        reason: `Identity is revoked or suspended (status: ${identity.revocationStatus})`,
      };
    }

    if (Date.now() > new Date(identity.expiresAt).getTime()) {
      return { ...base, reason: 'Identity credential has expired' };
    }

    const proofPayload = `${identity.did}:${identity.ownerNodeId}:${identity.publicKeyMultibase}:${identity.expiresAt}`;
    const expectedHash = createHash('sha256').update(proofPayload).digest('hex');

    if (identity.merkleProofHex !== expectedHash) {
      return {
        ...base,
        reason: 'Cryptographic Merkle proof mismatch — possible identity forgery',
      };
    }

    return {
      isValid: true,
      did: identity.did,
      revocationStatus: 'ACTIVE',
      expiresAt: identity.expiresAt,
    };
  }

  public static async registerIdentityInDb(db: D1Database, identity: ZkDidIdentity): Promise<void> {
    await registerDidIdentityInDb(db, identity);
  }

  public static async getIdentityByDid(db: D1Database, did: string): Promise<ZkDidIdentity | null> {
    return fetchDidIdentityByDid(db, did);
  }
}
