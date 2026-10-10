import type { D1Database } from '@cloudflare/workers-types';
import type { UnifiedRevenueSnapshot } from '@/seed/types/unified-revenue';
import { mapRowToSnapshot, type SnapshotDbRow } from './types';

/**
 * Retrieves the latest snapshot from D1.
 */
export async function getLatestUnifiedRevenueSnapshot(db: D1Database): Promise<UnifiedRevenueSnapshot | null> {
  const row = await db
    .prepare('SELECT * FROM unified_revenue_snapshots ORDER BY snapshot_timestamp DESC LIMIT 1')
    .first<SnapshotDbRow>();

  if (!row) return null;
  return mapRowToSnapshot(row);
}

/**
 * Retrieves historical snapshots from D1.
 */
export async function getUnifiedRevenueSnapshotsHistory(
  db: D1Database,
  limit = 12,
): Promise<UnifiedRevenueSnapshot[]> {
  const { results } = await db
    .prepare('SELECT * FROM unified_revenue_snapshots ORDER BY snapshot_timestamp DESC LIMIT ?')
    .bind(limit)
    .all<SnapshotDbRow>();

  if (!results) return [];
  return results.map(mapRowToSnapshot);
}
