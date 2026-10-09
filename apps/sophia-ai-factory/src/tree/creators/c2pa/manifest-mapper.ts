/**
 * @file manifest-mapper.ts
 * @description Database row definition and hydration mapping for C2PA provenance manifests.
 * @layer tree
 */

import type {
  C2paProvenanceManifestRecord,
  C2paTamperStatus,
} from '@/seed/types/creator-dao-c2pa';

export interface C2paManifestDbRow {
  id: string;
  manifest_id: string;
  asset_id: string;
  asset_sha256: string;
  claim_generator: string;
  title: string;
  format: string;
  claim_canonical_json: string;
  manifest_hash: string;
  signer_identity: string;
  signature_algorithm: string;
  digital_signature: string;
  assertions_json: string;
  ingredients_json: string;
  tamper_status: string;
  verified_at: number;
  created_at: number;
  updated_at: number;
}

/**
 * Maps raw SQLite/D1 database row into structured C2paProvenanceManifestRecord.
 */
export function mapManifestRow(row: C2paManifestDbRow): C2paProvenanceManifestRecord {
  return {
    id: row.id,
    manifestId: row.manifest_id,
    assetId: row.asset_id,
    assetSha256: row.asset_sha256,
    claimGenerator: row.claim_generator,
    title: row.title,
    format: row.format,
    claimCanonicalJson: row.claim_canonical_json,
    manifestHash: row.manifest_hash,
    signerIdentity: row.signer_identity,
    signatureAlgorithm: row.signature_algorithm,
    digitalSignature: row.digital_signature,
    assertionsJson: row.assertions_json,
    ingredientsJson: row.ingredients_json,
    tamperStatus: row.tamper_status as C2paTamperStatus,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
