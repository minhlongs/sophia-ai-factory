/**
 * Cloudflare R2 Vaulting and Content Asset Registration.
 *
 * Layer: forest (imports seed + tree only; zero land imports).
 *
 * @module forest/mission/orchestrator/asset-vault
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { newAssetId } from '@/tree/content-graph/types';

/**
 * Safely writes object payload to R2 bucket if bound in global runtime context.
 * Layer rule: pure global environment lookup without importing from land.
 */
export async function vaultToR2IfAvailable(
  storageKey: string,
  data: ArrayBuffer | string,
  contentType: string,
): Promise<boolean> {
  try {
    const globalObj = globalThis as unknown as {
      VIDEO_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      STORAGE_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      __env__?: {
        STORAGE_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
        VIDEO_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      };
      __env?: {
        STORAGE_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
        VIDEO_BUCKET?: { put(key: string, value: unknown, options?: unknown): Promise<unknown> };
      };
    };

    const bucket =
      globalObj.VIDEO_BUCKET ||
      globalObj.__env__?.VIDEO_BUCKET ||
      globalObj.__env?.VIDEO_BUCKET ||
      globalObj.STORAGE_BUCKET ||
      globalObj.__env__?.STORAGE_BUCKET ||
      globalObj.__env?.STORAGE_BUCKET;

    if (bucket && typeof bucket.put === 'function') {
      await bucket.put(storageKey, data, {
        httpMetadata: { contentType },
      });
      return true;
    }
  } catch (err) {
    logger.warn('[MultiTrackOrchestrator] R2 vaulting skipped or failed (non-fatal)', {
      storageKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return false;
}

/**
 * Insert metadata record into content_assets table.
 */
export async function registerContentAsset(params: {
  id?: string;
  workspaceId: string;
  projectId: string; // missionId
  type: string;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number;
  durationSeconds?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const assetId = params.id || newAssetId();
  const db = await getD1();
  const now = Math.floor(Date.now() / 1000);

  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO content_assets
             (id, project_id, workspace_id, type, storage_key, mime_type, size_bytes, duration_seconds, status, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          assetId,
          params.projectId,
          params.workspaceId,
          params.type,
          params.storageKey,
          params.mimeType,
          params.sizeBytes ?? 0,
          params.durationSeconds ?? 0,
          params.status ?? 'completed',
          JSON.stringify(params.metadata ?? {}),
          now,
          now,
        )
        .run();
    } catch (err) {
      logger.warn('[MultiTrackOrchestrator] Failed writing to content_assets table (non-fatal)', {
        assetId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return assetId;
}
