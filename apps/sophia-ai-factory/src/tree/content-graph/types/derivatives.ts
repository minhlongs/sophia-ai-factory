import { getD1 } from '@/seed/db/client';
import type { DerivativeAsset } from '@/seed/types/creative-domain';
import {
  ContentGraphError,
  newAssetId,
  derivativeRowToDomain,
  type DerivativeRow,
} from './common';

export async function createDerivative(derivative: DerivativeAsset): Promise<DerivativeAsset> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  derivative.id = derivative.id || newAssetId();
  derivative.createdAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO derivative_assets
           (id, workspace_id, source_asset_id, parent_asset_id, type, storage_key, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        derivative.id,
        derivative.workspaceId,
        derivative.sourceAssetId,
        derivative.parentAssetId,
        derivative.type,
        derivative.storageKey,
        JSON.stringify(derivative.metadata ?? {}),
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return derivative;
}

export async function getDerivativesOf(assetId: string): Promise<DerivativeAsset[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT * FROM derivative_assets WHERE source_asset_id = ?1 OR parent_asset_id = ?1 ORDER BY created_at ASC`
    )
    .bind(assetId)
    .all<DerivativeRow>();

  return (result.results ?? []).map(derivativeRowToDomain);
}
