/**
 * Status transition and failure mutation helpers for Distribution Asset CRUD.
 * @module tree/distribution/assets-mutations
 */

import { getD1 } from '@/seed/db/client';
import type { DistributionAsset } from '@/seed/types/creative-domain';
import { DistributionError } from './errors';
import {
  assetRowToDomain,
  type DistributionAssetRow,
} from './types';
import { isValidAssetTransition } from './asset-transitions';

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
