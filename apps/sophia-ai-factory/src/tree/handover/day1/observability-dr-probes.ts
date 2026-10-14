/**
 * Observability & Disaster Recovery (DR) Drill Probes for Day-1 Verification.
 * Layer: tree (Domain operations; imports only from @/seed and @/tree)
 *
 * @module tree/handover/day1/observability-dr-probes
 */

import type { D1Database } from '@/seed/db/client';
import type { CheckpointResult } from '@/seed/handover/handover-types';
import { executeDrDrillProbe } from '@/tree/handover/dr-drill-executor';

/**
 * 8. Checkpoint: Observability & APM (Better Stack, Honeycomb, Sentry)
 */
export async function probeObservability(): Promise<CheckpointResult> {
  const start = Date.now();
  const hasHoneycomb = !!process.env.HONEYCOMB_API_KEY;
  const hasSentry = !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;
  const hasMetricsToken = !!process.env.METRICS_BEARER_TOKEN;

  const latency = Date.now() - start;
  const activeChannels: string[] = [];
  if (hasHoneycomb) activeChannels.push('Honeycomb OTLP');
  if (hasSentry) activeChannels.push('Sentry Error Tracking');
  if (hasMetricsToken) activeChannels.push('/api/metrics APM');

  const hasPrimaryApm = hasHoneycomb || hasSentry;

  if (!hasPrimaryApm) {
    const fallbackText = activeChannels.length > 0
      ? activeChannels.join(', ')
      : 'Structured JSON Logger (CF Tail)';

    return {
      checkpointId: 'monitoring_betterstack',
      name: 'Production Telemetry & Observability Stack',
      nameVi: 'Hệ Thống Giám Sát & Truy Vết Hoạt Động',
      category: 'operations',
      status: 'WARN',
      latencyMs: latency,
      details: `Neither Honeycomb nor Sentry is configured (active fallback: ${fallbackText})`,
      expected: 'Honeycomb or Sentry configured',
      actual: fallbackText,
      diagnosticData: { hasHoneycomb, hasSentry, hasMetricsToken },
    };
  }

  return {
    checkpointId: 'monitoring_betterstack',
    name: 'Production Telemetry & Observability Stack',
    nameVi: 'Hệ Thống Giám Sát & Truy Vết Hoạt Động',
    category: 'operations',
    status: 'PASS',
    latencyMs: latency,
    details: `Active telemetry channels: ${activeChannels.join(', ')}`,
    expected: 'Honeycomb or Sentry configured',
    actual: activeChannels.join(', '),
    diagnosticData: { hasHoneycomb, hasSentry, hasMetricsToken },
  };
}

/**
 * 9. Checkpoint: Disaster Recovery (DR) Drill
 */
export async function probeDrDrill(
  envOverride?: Record<string, unknown>,
  dbOverride?: D1Database,
): Promise<CheckpointResult> {
  const drillResult = await executeDrDrillProbe(envOverride, dbOverride);
  return {
    checkpointId: 'dr_drill_backup',
    name: 'Automated Disaster Recovery (DR) Snapshot Drill',
    nameVi: 'Diễn Tập Sao Lưu Phục Hồi Thảm Họa (DR)',
    category: 'database',
    status: drillResult.status,
    latencyMs: drillResult.latencyMs,
    details: drillResult.details,
    expected: 'DR Drill PASS',
    actual: drillResult.status,
    diagnosticData: {
      tablesVerified: drillResult.tablesVerified,
      r2BackupObjectFound: drillResult.r2BackupObjectFound,
      latestBackupKey: drillResult.latestBackupKey ?? 'none',
    },
  };
}
