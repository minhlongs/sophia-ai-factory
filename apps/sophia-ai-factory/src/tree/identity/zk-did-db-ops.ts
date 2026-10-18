/**
 * zk-did-db-ops.ts — D1 persistence operations for ZK-DID identities
 * Layer: TREE (Business Logic)
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type ZkDidIdentity,
  rowToZkDidIdentity,
} from '@/seed/types/planetary-swarm';

/**
 * Persists an identity into Cloudflare D1.
 */
export async function registerDidIdentityInDb(
  db: D1Database,
  identity: ZkDidIdentity,
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO zk_did_identity_registry (
        id, did, owner_node_id, controller_uri, public_key_multibase,
        credential_schema_hash, revocation_status, proof_type,
        merkle_proof_hex, issued_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      identity.id,
      identity.did,
      identity.ownerNodeId,
      identity.controllerUri,
      identity.publicKeyMultibase,
      identity.credentialSchemaHash,
      identity.revocationStatus,
      identity.proofType,
      identity.merkleProofHex,
      identity.issuedAt,
      identity.expiresAt,
    )
    .run();
}

/**
 * Fetches an identity by DID from Cloudflare D1.
 */
export async function fetchDidIdentityByDid(
  db: D1Database,
  did: string,
): Promise<ZkDidIdentity | null> {
  const row = await db
    .prepare('SELECT * FROM zk_did_identity_registry WHERE did = ?')
    .bind(did)
    .first<Record<string, unknown>>();
  return row ? rowToZkDidIdentity(row) : null;
}
