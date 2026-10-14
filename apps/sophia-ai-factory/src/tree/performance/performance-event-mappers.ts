/**
 * Row ↔ Domain mappers and ID generator for PerformanceEvent D1 repository.
 * @module tree/performance/performance-event-mappers
 */

import type { PerformanceEvent } from '@/seed/types/creative-domain';

export function newPerformanceEventId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'pevt_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface PerformanceEventRow {
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
  metrics_json: string | null;
  recorded_at: number;
  raw_data: string | null;
}

export function performanceRowToDomain(row: PerformanceEventRow): PerformanceEvent {
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
    rawData: row.raw_data ? (JSON.parse(row.raw_data) as Record<string, unknown>) : undefined,
  };
}

export function performanceDomainToRow(event: PerformanceEvent): Omit<PerformanceEventRow, 'id'> {
  const serialized = event.rawData ? JSON.stringify(event.rawData) : '{}';
  return {
    workspace_id: event.workspaceId,
    asset_id: event.assetId,
    project_id: event.projectId,
    entity_type: event.entityType,
    entity_id: event.entityId,
    channel: event.channel,
    event_type: event.eventType,
    count: event.count,
    value_cents: event.valueCents ?? 0,
    recorded_at: event.recordedAt,
    metrics_json: serialized,
    raw_data: event.rawData ? JSON.stringify(event.rawData) : null,
  };
}
