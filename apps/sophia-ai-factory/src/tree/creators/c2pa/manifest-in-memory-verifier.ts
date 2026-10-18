/**
 * @file manifest-in-memory-verifier.ts
 * @description Pure in-memory cryptographic verification for C2PA provenance manifests.
 * @layer tree
 */

import type {
  C2paProvenanceManifestRecord,
  C2paVerificationResult,
} from '@/seed/types/creator-dao-c2pa';
import {
  getSigningSecret,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualHex,
} from './crypto-primitives';

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
