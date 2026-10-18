/**
 * Audience metrics row mapping and ID generation helpers.
 *
 * Layer: tree (domain-reusable).
 * @module tree/audience/metrics-store-row
 */

import type { AudienceMetrics, AudiencePlatform, Demographics } from './types';

export interface MetricsStoreError {
  code: 'INVALID_INPUT' | 'INSERT_FAILED' | 'QUERY_FAILED';
  message: string;
}

/** D1 row shape for audience_metrics. */
export interface AudienceMetricsRow {
  id: string;
  workspace_id: string;
  platform: string;
  followers: number;
  engagement_rate: number;
  demographics: string; // JSON
  window_start_ms: number;
  window_end_ms: number;
  created_at: number;
}

export function newMetricsId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `am_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function parseMetricsRow(row: AudienceMetricsRow): AudienceMetrics {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    platform: row.platform as AudiencePlatform,
    followers: row.followers,
    engagementRate: row.engagement_rate,
    demographics: JSON.parse(row.demographics) as Demographics,
    windowStartMs: row.window_start_ms,
    windowEndMs: row.window_end_ms,
    createdAt: row.created_at,
  };
}
