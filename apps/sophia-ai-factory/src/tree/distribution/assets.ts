/**
 * Distribution Asset CRUD — D1 repository.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/assets
 */

import { getD1 } from '@/seed/db/client';
import type { DistributionAsset } from '@/seed/types/creative-domain';
import { DistributionError } from './errors';
import {
  newDistributionAssetId,
  assetRowToDomain,
  assetDomainToRow,
  type DistributionAssetRow,
} from './types';

// ─── Status transition guards ────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DistributionAsset['status'], DistributionAsset['status'][]> = {
  draft: ['scheduled', 'posting', 'failed'],
  scheduled: ['posting', 'failed'],
  posting: ['posted', 'failed'],
  posted: ['failed'],
  failed: ['scheduled'],
};

export function isValidAssetTransition(
  from: DistributionAsset['status'],
  to: DistributionAsset['status'],
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createDistributionAsset(
  asset: Omit<DistributionAsset, 'id' | 'createdAt'>,
): Promise<DistributionAsset> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const id = newDistributionAssetId();
  const now = Math.floor(Date.now() / 1000);
  const row = assetDomainToRow({ ...asset, id, createdAt: now });

  try {
    await db
      .prepare(
        `INSERT INTO distribution_assets
         (id, workspace_id, plan_id, asset_id, channel, platform_post_id, status,
          scheduled_at, posted_at, analytics, error, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(
        id,
        row.workspace_id,
        row.plan_id,
        row.asset_id,
        row.channel,
        row.platform_post_id,
        row.status,
        row.scheduled_at,
        row.posted_at,
        row.analytics,
        row.error,
        row.created_at,
      )
      .run();
  } catch (err) {
    throw new DistributionError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }

  return assetRowToDomain({ ...row, id, created_at: row.created_at });
}

export async function getDistributionAsset(
  id: string,
  workspaceId: string,
): Promise<DistributionAsset> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM distribution_assets WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionAssetRow>();

  if (!row) {
    throw new DistributionError('NOT_FOUND', `Asset ${id} not found`);
  }

  return assetRowToDomain(row);
}

export async function listDistributionAssets(
  workspaceId: string,
  planId?: string,
): Promise<DistributionAsset[]> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  let query = 'SELECT * FROM distribution_assets WHERE workspace_id = ?1';
  const params: unknown[] = [workspaceId];

  if (planId) {
    query += ' AND plan_id = ?2';
    params.push(planId);
  }

  query += ' ORDER BY created_at DESC';

  const result = await db.prepare(query).bind(...params).all<DistributionAssetRow>();
  return (result.results ?? []).map(assetRowToDomain);
}

export async function updateDistributionAssetStatus(
  id: string,
  status: DistributionAsset['status'],
  workspaceId: string,
): Promise<DistributionAsset> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);

  const current = await db
    .prepare(`SELECT * FROM distribution_assets WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionAssetRow>();

  if (!current) {
    throw new DistributionError('NOT_FOUND', `Asset ${id} not found`);
  }

  if (!isValidAssetTransition(current.status as DistributionAsset['status'], status)) {
    throw new DistributionError(
      'INVALID_TRANSITION',
      `Cannot transition asset ${id} from ${current.status} to ${status}`,
    );
  }

  const updates: Record<string, string | number> = {
    status,
    updated_at: now,
  };

  if (status === 'posted') {
    updates.posted_at = now;
  }

  await db
    .prepare(
      `UPDATE distribution_assets SET status = ?1, updated_at = ?2 WHERE id = ?3 AND workspace_id = ?4`,
    )
    .bind(status, now, id, workspaceId)
    .run();

  const updated = await db
    .prepare(`SELECT * FROM distribution_assets WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionAssetRow>();

  if (!updated) {
    throw new DistributionError('NOT_FOUND', `Asset ${id} not found after update`);
  }

  return assetRowToDomain(updated);
}

export async function markDistributionAssetFailed(
  id: string,
  error: string,
  workspaceId: string,
): Promise<DistributionAsset> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE distribution_assets
       SET status = 'failed', error = ?1, updated_at = ?2
       WHERE id = ?3 AND workspace_id = ?4`,
    )
    .bind(error, now, id, workspaceId)
    .run();

  const updated = await db
    .prepare(`SELECT * FROM distribution_assets WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionAssetRow>();

  if (!updated) {
    throw new DistributionError('NOT_FOUND', `Asset ${id} not found after update`);
  }

  return assetRowToDomain(updated);
}

