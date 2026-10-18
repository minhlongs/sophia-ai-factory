/**
 * PerformanceEvent D1 query helpers.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/performance-event-queries
 */

import { getD1 } from '@/seed/db/client';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { PerformanceError } from './errors';
import {
  performanceRowToDomain as rowToDomain,
  type PerformanceEventRow,
} from './performance-event-mappers';

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
