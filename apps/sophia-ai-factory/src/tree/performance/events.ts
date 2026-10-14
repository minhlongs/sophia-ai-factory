/**
 * PerformanceEvent D1 repository.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/events
 */

import { getD1 } from '@/seed/db/client';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { PerformanceError } from './errors';
import {
  newPerformanceEventId,
  performanceRowToDomain as rowToDomain,
  performanceDomainToRow as domainToRow,
  type PerformanceEventRow,
} from './performance-event-mappers';

export {
  newPerformanceEventId,
  performanceRowToDomain,
  performanceDomainToRow,
} from './performance-event-mappers';

// ─── Repository functions ──────────────────────────────────────────────────

export async function recordPerformanceEvent(
  event: PerformanceEvent,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const id = event.id || newPerformanceEventId();
  const row: PerformanceEventRow = {
    id,
    ...domainToRow({ ...event, id }),
  };

  try {
    await db
      .prepare(
        `INSERT INTO performance_events
           (id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, metrics_json, recorded_at, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, row.workspace_id, row.asset_id, row.project_id,
        row.entity_type, row.entity_id, row.channel, row.event_type,
        row.count, row.value_cents, row.metrics_json, row.recorded_at, row.raw_data,
      )
      .run();
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

/**
 * Idempotent variant of recordPerformanceEvent.
 * Uses INSERT OR IGNORE on the id primary key: a re-insert with the same
 * deterministic id is a no-op instead of throwing.
 * Returns true when a new row was inserted, false when the id already existed.
 */
export async function recordPerformanceEventIdempotent(
  event: PerformanceEvent,
): Promise<boolean> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const id = event.id || newPerformanceEventId();
  const row: PerformanceEventRow = {
    id,
    ...domainToRow({ ...event, id }),
  };

  try {
    const { meta } = await db
      .prepare(
        `INSERT OR IGNORE INTO performance_events
           (id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, metrics_json, recorded_at, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, row.workspace_id, row.asset_id, row.project_id,
        row.entity_type, row.entity_id, row.channel, row.event_type,
        row.count, row.value_cents, row.metrics_json, row.recorded_at, row.raw_data,
      )
      .run();
    return (meta?.changes ?? 0) > 0;
  } catch (err) {
    throw new PerformanceError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

export async function getPerformanceEvents(
  workspaceId: string,
  opts?: {
    projectId?: string;
    channel?: string;
    dateRange?: { from: number; to: number };
  },
): Promise<PerformanceEvent[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?1'];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (opts?.projectId) {
    conditions.push(`project_id = ?${idx}`);
    params.push(opts.projectId);
    idx++;
  }
  if (opts?.channel) {
    conditions.push(`channel = ?${idx}`);
    params.push(opts.channel);
    idx++;
  }
  if (opts?.dateRange) {
    conditions.push(`recorded_at >= ?${idx}`);
    params.push(opts.dateRange.from);
    idx++;
    conditions.push(`recorded_at <= ?${idx}`);
    params.push(opts.dateRange.to);
    idx++;
  }

  const where = conditions.join(' AND ');
  const result = await db
    .prepare(`SELECT * FROM performance_events WHERE ${where} ORDER BY recorded_at DESC`)
    .bind(...params)
    .all<PerformanceEventRow>();

  return (result.results ?? []).map(rowToDomain);
}