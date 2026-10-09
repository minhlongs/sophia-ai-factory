/**
 * @file manifest-signer.ts
 * @description Creates, canonically serializes, cryptographically signs, and stores C2PA manifests in D1.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  C2PA_CLAIM_GENERATOR_DEFAULT,
  C2PA_DEFAULT_SIGNER_IDENTITY,
  type C2paProvenanceManifestRecord,
  type CreateC2paManifestInput,
} from '@/seed/types/creator-dao-c2pa';
import {
  canonicalJson,
  getSigningSecret,
  hmacSha256Hex,
  sha256Hex,
} from './crypto-primitives';
import { createC2paClaim } from './claim-builder';

/**
 * Creates, canonically serializes, cryptographically signs, and stores a C2PA manifest.
 */
export async function signC2paManifest(
  db: D1Database,
  input: CreateC2paManifestInput,
): Promise<C2paProvenanceManifestRecord> {
  // 1. Resolve exact asset SHA-256
  let assetSha256: string;
  if (typeof input.assetBytesOrSha256 === 'string') {
    if (input.assetBytesOrSha256.length === 64 && /^[0-9a-fA-F]{64}$/.test(input.assetBytesOrSha256)) {
      assetSha256 = input.assetBytesOrSha256.toLowerCase();
    } else {
      assetSha256 = await sha256Hex(input.assetBytesOrSha256);
    }
  } else {
    assetSha256 = await sha256Hex(input.assetBytesOrSha256);
  }

  // 2. Build claim structure
  const claim = createC2paClaim(input, assetSha256);

  // 3. Deterministic canonical JSON serialization
  const claimCanonicalJson = canonicalJson(claim);

  // 4. Manifest digest
  const manifestHash = await sha256Hex(claimCanonicalJson);

  // 5. Web Crypto digital signature
  const signingSecret = getSigningSecret(input.signingSecret);
  const digitalSignature = await hmacSha256Hex(manifestHash, signingSecret);

  // 6. Persistence to D1
  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  const manifestId = claim.instanceId;
  const now = Date.now();
  const format = input.format ?? 'video/mp4';
  const assertionsJson = JSON.stringify(claim.assertions);
  const ingredientsJson = JSON.stringify(claim.ingredients);

  await db
    .prepare(
      `INSERT INTO c2pa_provenance_manifests (
        id, manifest_id, asset_id, asset_sha256, claim_generator, title, format,
        claim_canonical_json, manifest_hash, signer_identity, signature_algorithm,
        digital_signature, assertions_json, ingredients_json, tamper_status,
        verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?, ?)`,
    )
    .bind(
      id,
      manifestId,
      input.assetId,
      assetSha256,
      C2PA_CLAIM_GENERATOR_DEFAULT,
      input.title,
      format,
      claimCanonicalJson,
      manifestHash,
      C2PA_DEFAULT_SIGNER_IDENTITY,
      'HMAC-SHA256',
      digitalSignature,
      assertionsJson,
      ingredientsJson,
      now,
      now,
      now,
    )
    .run();

  logger.info('Signed and stored C2PA provenance manifest', {
    manifestId,
    assetId: input.assetId,
    assetSha256,
    manifestHash,
  });

  return {
    id,
    manifestId,
    assetId: input.assetId,
    assetSha256,
    claimGenerator: C2PA_CLAIM_GENERATOR_DEFAULT,
    title: input.title,
    format,
    claimCanonicalJson,
    manifestHash,
    signerIdentity: C2PA_DEFAULT_SIGNER_IDENTITY,
    signatureAlgorithm: 'HMAC-SHA256',
    digitalSignature,
    assertionsJson,
    ingredientsJson,
    tamperStatus: 'valid',
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}
