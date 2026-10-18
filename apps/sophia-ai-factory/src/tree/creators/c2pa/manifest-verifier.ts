/**
 * @file manifest-verifier.ts
 * @description Tamper-evidence verification engine for C2PA provenance manifests and digital signatures.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import type {
  C2paTamperStatus,
  C2paVerificationResult,
} from '@/seed/types/creator-dao-c2pa';
import { sha256Hex } from './crypto-primitives';
import { type C2paManifestDbRow, mapManifestRow } from './manifest-mapper';
import { verifyC2paManifestInMemory } from './manifest-in-memory-verifier';

export { verifyC2paManifestInMemory };

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
