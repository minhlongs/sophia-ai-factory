/**
 * PerformanceEvent D1 repository.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/events
 */

import { getD1 } from '@/seed/db/client';
import type { PerformanceEvent } from '@/seed/types/creative-domain';
import { PerformanceError } from './errors';

// ─── ID generation ─────────────────────────────────────────────────────────

export function newPerformanceEventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'pevt_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Row types ─────────────────────────────────────────────────────────────

interface PerformanceEventRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  event_type: string;
  count: number;
  value_cents: number | null;
  recorded_at: number;
  raw_data: string | null;
}

// ─── Row ↔ Domain mapping ──────────────────────────────────────────────────

function rowToDomain(row: PerformanceEventRow): PerformanceEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    assetId: row.asset_id,
    projectId: row.project_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    channel: row.channel,
    eventType: row.event_type,
    count: row.count,
    valueCents: row.value_cents ?? undefined,
    recordedAt: row.recorded_at,
    rawData: row.raw_data ? JSON.parse(row.raw_data) as Record<string, unknown> : undefined,
  };
}

function domainToRow(event: PerformanceEvent): Omit<PerformanceEventRow, 'id'> {
  return {
    workspace_id: event.workspaceId,
    asset_id: event.assetId,
    project_id: event.projectId,
    entity_type: event.entityType,
    entity_id: event.entityId,
    channel: event.channel,
    event_type: event.eventType,
    count: event.count,
    value_cents: event.valueCents ?? null,
    recorded_at: event.recordedAt,
    raw_data: event.rawData ? JSON.stringify(event.rawData) : null,
  };
}

export { rowToDomain as performanceRowToDomain, domainToRow as performanceDomainToRow };

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
           (id, workspace_id, asset_id, project_id, entity_type, entity_id, channel, event_type, count, value_cents, recorded_at, raw_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id, row.workspace_id, row.asset_id, row.project_id,
        row.entity_type, row.entity_id, row.channel, row.event_type,
        row.count, row.value_cents, row.recorded_at, row.raw_data,
      )
      .run();
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