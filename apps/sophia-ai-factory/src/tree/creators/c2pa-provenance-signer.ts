/**
 * C2PA Tamper-Evident Content Provenance Signer & Verification Engine
 *
 * Implements Coalition for Content Provenance and Authenticity (C2PA) standard claims:
 * - Deterministic Canonical JSON serialization (alphabetically sorted keys)
 * - SHA-256 asset content hashing (anti-deepfake fingerprinting)
 * - HMAC-SHA256 digital signing over manifest claims (Edge Web Crypto)
 * - 1-byte tamper-evidence verification: detects any mutated bit in asset, claim, or signature
 *
 * Layer: tree (Pure domain logic & edge-compatible Web Crypto, zero Node native modules)
 * Dependencies: @/seed/types/creator-dao-c2pa, @/seed/db/client, @/seed/utils/logger-utility
 *
 * @module tree/creators/c2pa-provenance-signer
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  C2PA_CLAIM_GENERATOR_DEFAULT,
  C2PA_DEFAULT_SIGNER_IDENTITY,
  type C2paAssertion,
  type C2paClaim,
  type C2paIngredient,
  type C2paProvenanceManifestRecord,
  type C2paTamperStatus,
  type C2paVerificationResult,
  type CreateC2paManifestInput,
} from '@/seed/types/creator-dao-c2pa';

// ─── Cryptographic Primitives (Web Crypto API) ──────────────────────────────

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (crypto.subtle) is not available in current runtime environment.');
}

/**
 * Converts ArrayBuffer or Uint8Array to lowercase hex string.
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.toLowerCase();
}

/**
 * Deterministically serializes any JavaScript value to canonical JSON.
 * - Object keys are sorted alphabetically at every nesting level
 * - Primitives, arrays, and null are serialized identically
 * - Undefined values in objects are skipped
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Computes SHA-256 digest returning a 64-character lowercase hex string.
 */
export async function sha256Hex(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const subtle = getSubtleCrypto();
  let bufferSource: BufferSource;
  if (typeof data === 'string') {
    bufferSource = new TextEncoder().encode(data);
  } else {
    bufferSource = data as unknown as BufferSource;
  }
  const digest = await subtle.digest('SHA-256', bufferSource);
  return bufferToHex(digest);
}

/**
 * Computes HMAC-SHA256 digital signature returning lowercase hex string.
 */
export async function hmacSha256Hex(data: string, secret: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const keyBuffer = new TextEncoder().encode(secret);
  const cryptoKey = await subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const dataBuffer = new TextEncoder().encode(data);
  const signature = await subtle.sign('HMAC', cryptoKey, dataBuffer);
  return bufferToHex(signature);
}

/**
 * Constant-time comparison of two hex strings to prevent timing attacks.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Default Signing Key Resolver ───────────────────────────────────────────

export function getSigningSecret(customSecret?: string): string {
  if (customSecret && customSecret.length > 0) return customSecret;
  if (typeof process !== 'undefined' && process.env?.C2PA_SIGNING_SECRET) {
    return process.env.C2PA_SIGNING_SECRET;
  }
  return 'sophia_c2pa_root_authority_2027_production_signing_key_hmac_sha256';
}

// ─── C2PA Claim Construction ────────────────────────────────────────────────

/**
 * Constructs a C2PA standard claim object with all assertions and metadata.
 */
export function createC2paClaim(input: CreateC2paManifestInput, assetSha256: string): C2paClaim {
  const assertions: C2paAssertion[] = [
    {
      label: 'c2pa.actions',
      data: {
        actions: [
          {
            action: 'c2pa.created',
            when: new Date().toISOString(),
            softwareAgent: C2PA_CLAIM_GENERATOR_DEFAULT,
          },
          {
            action: 'c2pa.ai_generated',
            when: new Date().toISOString(),
            models: input.aiModelsUsed ?? [
              { name: 'Sophia-Video-Synthesis-Engine', version: '2.5', role: 'video_generation' },
            ],
          },
        ],
      },
    },
    {
      label: 'c2pa.ai_generation',
      data: {
        engine: 'Sophia AI Factory Video Synthesis Core 2027',
        models: input.aiModelsUsed ?? [
          { name: 'Sophia-Video-Synthesis-Engine', version: '2.5', role: 'video_generation' },
        ],
      },
    },
    {
      label: 'c2pa.hash.data',
      data: {
        assetSha256,
        format: input.format ?? 'video/mp4',
        uri: `urn:c2pa:asset:${input.assetId}`,
      },
    },
    {
      label: 'c2pa.author',
      data: {
        creatorId: input.creatorId,
        daoId: input.daoId ?? null,
        licensingContractId: input.licensingContractId ?? null,
        authority: C2PA_DEFAULT_SIGNER_IDENTITY,
      },
    },
  ];

  if (input.dubbingDetails) {
    assertions.push({
      label: 'c2pa.dubbed',
      data: {
        sourceLanguage: input.dubbingDetails.sourceLang,
        targetLanguage: input.dubbingDetails.targetLang,
        voiceModel: input.dubbingDetails.voiceModel,
      },
    });
  }

  if (input.customAssertions && input.customAssertions.length > 0) {
    for (const custom of input.customAssertions) {
      assertions.push(custom);
    }
  }

  const ingredients: C2paIngredient[] = input.ingredients ?? [];

  return {
    claimGenerator: C2PA_CLAIM_GENERATOR_DEFAULT,
    title: input.title,
    format: input.format ?? 'video/mp4',
    instanceId: `urn:c2pa:sophia:manifest:${Date.now()}:${input.assetId}`,
    assertions,
    ingredients,
    signatureAlgorithm: 'HMAC-SHA256',
  };
}

// ─── D1 Row Mapping Helper ──────────────────────────────────────────────────

interface C2paManifestDbRow {
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

function mapManifestRow(row: C2paManifestDbRow): C2paProvenanceManifestRecord {
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

// ─── Sign & Store C2PA Manifest ─────────────────────────────────────────────

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

// ─── Tamper-Evidence Verification Engine ─────────────────────────────────────

/**
 * Pure in-memory verification of a C2PA manifest record against potential 1-byte tamper modifications.
 * Performs a 3-point cryptographic check:
 * 1. Asset SHA-256 match (anti-deepfake check)
 * 2. Manifest Hash canonical integrity
 * 3. Digital Signature verification
 */
export async function verifyC2paManifestInMemory(
  manifest: C2paProvenanceManifestRecord,
  currentAssetSha256?: string,
  signingSecret?: string,
): Promise<C2paVerificationResult> {
  const verifiedAt = Date.now();
  const secret = getSigningSecret(signingSecret);

  // Check 1: Asset SHA-256 integrity
  if (currentAssetSha256) {
    const normalizedCurrent = currentAssetSha256.toLowerCase();
    const normalizedStored = manifest.assetSha256.toLowerCase();
    if (normalizedCurrent !== normalizedStored) {
      return {
        isValid: false,
        tamperDetected: true,
        tamperReason: 'ASSET_SHA256_MISMATCH',
        manifestId: manifest.manifestId,
        assetId: manifest.assetId,
        storedAssetSha256: manifest.assetSha256,
        computedAssetSha256: normalizedCurrent,
        signatureValid: false,
        hashChainValid: false,
        verifiedAt,
      };
    }
  }

  // Check 2: Manifest Hash canonical integrity
  const recomputedManifestHash = await sha256Hex(manifest.claimCanonicalJson);
  if (!timingSafeEqualHex(recomputedManifestHash, manifest.manifestHash)) {
    return {
      isValid: false,
      tamperDetected: true,
      tamperReason: 'MANIFEST_HASH_TAMPERED',
      manifestId: manifest.manifestId,
      assetId: manifest.assetId,
      storedAssetSha256: manifest.assetSha256,
      computedAssetSha256: currentAssetSha256,
      signatureValid: false,
      hashChainValid: false,
      verifiedAt,
    };
  }

  // Check 3: Digital Signature validity
  const expectedSignature = await hmacSha256Hex(manifest.manifestHash, secret);
  const signatureMatches = timingSafeEqualHex(expectedSignature, manifest.digitalSignature);
  if (!signatureMatches) {
    return {
      isValid: false,
      tamperDetected: true,
      tamperReason: 'SIGNATURE_INVALID',
      manifestId: manifest.manifestId,
      assetId: manifest.assetId,
      storedAssetSha256: manifest.assetSha256,
      computedAssetSha256: currentAssetSha256,
      signatureValid: false,
      hashChainValid: true,
      verifiedAt,
    };
  }

  // All 3 checks passed
  return {
    isValid: true,
    tamperDetected: false,
    manifestId: manifest.manifestId,
    assetId: manifest.assetId,
    storedAssetSha256: manifest.assetSha256,
    computedAssetSha256: currentAssetSha256 ?? manifest.assetSha256,
    signatureValid: true,
    hashChainValid: true,
    verifiedAt,
  };
}

/**
 * Loads a C2PA manifest from D1, verifies it against current asset and signature,
 * and updates `tamper_status` in D1 if tampering is detected.
 */
export async function verifyC2paManifest(
  db: D1Database,
  manifestId: string,
  currentAssetSha256OrBytes?: string | Uint8Array | ArrayBuffer,
  signingSecret?: string,
): Promise<C2paVerificationResult> {
  const verifiedAt = Date.now();

  const row = await db
    .prepare('SELECT * FROM c2pa_provenance_manifests WHERE manifest_id = ? LIMIT 1')
    .bind(manifestId)
    .first<C2paManifestDbRow>();

  if (!row) {
    return {
      isValid: false,
      tamperDetected: true,
      tamperReason: 'RECORD_NOT_FOUND',
      manifestId,
      assetId: '',
      storedAssetSha256: '',
      signatureValid: false,
      hashChainValid: false,
      verifiedAt,
    };
  }

  const manifest = mapManifestRow(row);

  let currentSha: string | undefined;
  if (currentAssetSha256OrBytes) {
    if (typeof currentAssetSha256OrBytes === 'string') {
      if (currentAssetSha256OrBytes.length === 64 && /^[0-9a-fA-F]{64}$/.test(currentAssetSha256OrBytes)) {
        currentSha = currentAssetSha256OrBytes.toLowerCase();
      } else {
        currentSha = await sha256Hex(currentAssetSha256OrBytes);
      }
    } else {
      currentSha = await sha256Hex(currentAssetSha256OrBytes);
    }
  }

  const result = await verifyC2paManifestInMemory(manifest, currentSha, signingSecret);

  // If tamper status changed, update D1 record
  const newStatus: C2paTamperStatus = result.isValid ? 'valid' : 'tampered';
  if (newStatus !== manifest.tamperStatus) {
    await db
      .prepare('UPDATE c2pa_provenance_manifests SET tamper_status = ?, verified_at = ?, updated_at = ? WHERE id = ?')
      .bind(newStatus, verifiedAt, verifiedAt, manifest.id)
      .run();
  }

  return result;
}

// ─── Query Functions ────────────────────────────────────────────────────────

export async function getManifestByAssetId(
  db: D1Database,
  assetId: string,
): Promise<C2paProvenanceManifestRecord | null> {
  const row = await db
    .prepare('SELECT * FROM c2pa_provenance_manifests WHERE asset_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(assetId)
    .first<C2paManifestDbRow>();

  if (!row) return null;
  return mapManifestRow(row);
}

export async function getManifestById(
  db: D1Database,
  manifestId: string,
): Promise<C2paProvenanceManifestRecord | null> {
  const row = await db
    .prepare('SELECT * FROM c2pa_provenance_manifests WHERE manifest_id = ? LIMIT 1')
    .bind(manifestId)
    .first<C2paManifestDbRow>();

  if (!row) return null;
  return mapManifestRow(row);
}
