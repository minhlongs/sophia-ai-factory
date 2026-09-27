/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { ZkDidVerifier, type DidIssuanceInput } from '../zk-did-verifier';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('ZkDidVerifier — Unit Tests', () => {
  let db: D1Database;

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS zk_did_identity_registry (
        id TEXT PRIMARY KEY,
        did TEXT NOT NULL UNIQUE,
        owner_node_id TEXT NOT NULL,
        controller_uri TEXT NOT NULL,
        public_key_multibase TEXT NOT NULL,
        credential_schema_hash TEXT NOT NULL,
        revocation_status TEXT NOT NULL,
        proof_type TEXT NOT NULL,
        merkle_proof_hex TEXT NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. ZK-DID Issuance and Verification', () => {
    it('issues valid W3C DID document with cryptographic Merkle proof', () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_iad_1',
        controllerUri: 'https://agencyos.network/controllers/node_iad_1',
        publicKeyMultibase: 'z6MkuV8zWv7k...',
        credentialSchemaHash: 'schema_hash_gate11_agent_v3',
        validityDays: 180,
      };

      const identity = ZkDidVerifier.issueIdentity(input);
      expect(identity.did).toMatch(/^did:sophia:zk:[a-f0-9]{32}$/);
      expect(identity.revocationStatus).toBe('ACTIVE');
      expect(identity.merkleProofHex).toHaveLength(64);

      const verification = ZkDidVerifier.verifyIdentity(identity);
      expect(verification.isValid).toBe(true);
      expect(verification.did).toBe(identity.did);
      expect(verification.revocationStatus).toBe('ACTIVE');
    });

    it('rejects tampered Merkle proof (anti-forgery)', () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_iad_1',
        controllerUri: 'https://agencyos.network/controllers/node_iad_1',
        publicKeyMultibase: 'z6MkuV8zWv7k...',
        credentialSchemaHash: 'schema_hash_gate11_agent_v3',
      };

      const identity = ZkDidVerifier.issueIdentity(input);
      const forgedIdentity = { ...identity, merkleProofHex: 'deadbeef'.repeat(8) };

      const verification = ZkDidVerifier.verifyIdentity(forgedIdentity);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('Merkle proof mismatch');
    });

    it('rejects revoked or suspended identities', () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_iad_1',
        controllerUri: 'https://agencyos.network/controllers/node_iad_1',
        publicKeyMultibase: 'z6MkuV8zWv7k...',
        credentialSchemaHash: 'schema_hash_gate11_agent_v3',
      };

      const identity = ZkDidVerifier.issueIdentity(input);
      const revokedIdentity = { ...identity, revocationStatus: 'REVOKED' as const };

      const verification = ZkDidVerifier.verifyIdentity(revokedIdentity);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('revoked or suspended');
    });

    it('rejects expired identities', () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_iad_1',
        controllerUri: 'https://agencyos.network/controllers/node_iad_1',
        publicKeyMultibase: 'z6MkuV8zWv7k...',
        credentialSchemaHash: 'schema_hash_gate11_agent_v3',
        validityDays: -1, // Expired yesterday
      };

      const identity = ZkDidVerifier.issueIdentity(input);
      const verification = ZkDidVerifier.verifyIdentity(identity);
      expect(verification.isValid).toBe(false);
      expect(verification.reason).toContain('expired');
    });
  });

  describe('2. D1 Identity Persistence', () => {
    it('registers and retrieves DID from D1 database', async () => {
      const input: DidIssuanceInput = {
        ownerNodeId: 'node_sin_1',
        controllerUri: 'https://agencyos.network/controllers/node_sin_1',
        publicKeyMultibase: 'z6MkuV8zWv7kSin...',
        credentialSchemaHash: 'schema_hash_gate11_v3',
      };

      const identity = ZkDidVerifier.issueIdentity(input, 'did_id_1');
      await ZkDidVerifier.registerIdentityInDb(db, identity);

      const loaded = await ZkDidVerifier.getIdentityByDid(db, identity.did);
      expect(loaded).not.toBeNull();
      expect(loaded?.did).toBe(identity.did);
      expect(loaded?.ownerNodeId).toBe('node_sin_1');
    });
  });
});
