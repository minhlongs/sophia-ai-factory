import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { WorkspaceContentRoi, RoiRow } from './types';
import { EMPTY_WORKSPACE } from './types';
import { CONTENT_ROI_QUERY } from './sql-queries';
import { aggregateRoiRows } from './roi-aggregator';

/**
 * Resolve ROI for every ContentProject in a workspace.
 * Returns zero-data sentinel (hasData: false) when roi_records is empty
 * or D1 is unavailable — never throws.
 */
export async function resolveContentRoi(
  workspaceId: string,
): Promise<WorkspaceContentRoi> {
  if (!workspaceId) return { ...EMPTY_WORKSPACE, workspaceId };

  const db = await getD1();
  if (!db) {
    logger.warn('[ContentRoiResolver] D1 unavailable');
    return { ...EMPTY_WORKSPACE, workspaceId };
  }

  try {
    const { results } = await db
      .prepare(CONTENT_ROI_QUERY)
      .bind(workspaceId)
      .all<RoiRow>();

    return aggregateRoiRows(results ?? [], workspaceId);
  } catch (err) {
    logger.error('[ContentRoiResolver] Query failed', { error: String(err) });
    return { ...EMPTY_WORKSPACE, workspaceId };
  }
}
