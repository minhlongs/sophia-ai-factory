import { getD1 } from '@/seed/db/client';
import type { ContentAsset, ContentStatus } from '@/seed/types/creative-domain';
import {
  ContentGraphError,
  newAssetId,
  assetRowToDomain,
  type AssetRow,
} from './common';

export async function createAsset(asset: ContentAsset): Promise<ContentAsset> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  asset.id = asset.id || newAssetId();
  asset.createdAt = now;
  asset.updatedAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO content_assets
           (id, workspace_id, project_id, type, storage_key, mime_type,
            size_bytes, duration_seconds, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        asset.id,
        asset.workspaceId,
        asset.projectId,
        asset.type,
        asset.storageKey ?? null,
        asset.mimeType ?? null,
        asset.sizeBytes ?? null,
        asset.durationSeconds ?? null,
        asset.status,
        JSON.stringify(asset.metadata ?? {}),
        now,
        now,
      )
      .run();
  } catch (err) {
    throw new ContentGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return asset;
}

export async function getAsset(id: string, workspaceId?: string): Promise<ContentAsset | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = workspaceId
    ? await db
        .prepare(`SELECT * FROM content_assets WHERE id = ?1 AND workspace_id = ?2 LIMIT 1`)
        .bind(id, workspaceId)
        .first<AssetRow>()
    : await db
        .prepare(`SELECT * FROM content_assets WHERE id = ?1 LIMIT 1`)
        .bind(id)
        .first<AssetRow>();
  return row ? assetRowToDomain(row) : null;
}

export async function listAssets(
  projectId: string,
  workspaceId?: string
): Promise<ContentAsset[]> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = workspaceId
    ? await db
        .prepare(`SELECT * FROM content_assets WHERE project_id = ?1 AND workspace_id = ?2 ORDER BY created_at ASC`)
        .bind(projectId, workspaceId)
        .all<AssetRow>()
    : await db
        .prepare(`SELECT * FROM content_assets WHERE project_id = ?1 ORDER BY created_at ASC`)
        .bind(projectId)
        .all<AssetRow>();
  return (result.results ?? []).map(assetRowToDomain);
}

export async function updateAssetStatus(
  id: string,
  status: ContentStatus,
  workspaceId?: string
): Promise<ContentAsset | null> {
  const db = await getD1();
  if (!db) throw new ContentGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  if (workspaceId) {
    await db
      .prepare(`UPDATE content_assets SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`)
      .bind(status, now, id, workspaceId)
      .run();
    return getAsset(id, workspaceId);
  }

  await db
    .prepare(`UPDATE content_assets SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, now, id)
    .run();
  return getAsset(id);
}
