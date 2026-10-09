/**
 * @file manifest-repository.ts
 * @description Database query lookups for C2PA provenance manifests in D1.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import type { C2paProvenanceManifestRecord } from '@/seed/types/creator-dao-c2pa';
import { type C2paManifestDbRow, mapManifestRow } from './manifest-mapper';

/**
 * Retrieves the most recent C2PA provenance manifest for an asset ID.
 */
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

/**
 * Retrieves a C2PA provenance manifest by its unique manifest ID.
 */
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
