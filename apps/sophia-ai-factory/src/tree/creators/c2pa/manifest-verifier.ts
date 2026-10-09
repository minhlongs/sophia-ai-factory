/**
 * @file manifest-verifier.ts
 * @description Tamper-evidence verification engine for C2PA provenance manifests and digital signatures.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import type {
  C2paProvenanceManifestRecord,
  C2paTamperStatus,
  C2paVerificationResult,
} from '@/seed/types/creator-dao-c2pa';
import {
  getSigningSecret,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualHex,
} from './crypto-primitives';
import { type C2paManifestDbRow, mapManifestRow } from './manifest-mapper';

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
