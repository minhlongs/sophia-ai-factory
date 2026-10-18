/**
 * Funnel dashboard step calculation and campaign lifecycle helpers.
 *
 * Extracted from funnel-dashboard.ts for modularization.
 *
 * @module land/analytics/funnel-dashboard-helpers
 */

import type { FunnelStepData } from '@/seed/types/analytics-funnel';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  queued: 'Queued',
  processing_script: 'Writing Script',
  processing_video: 'Rendering Video',
  completed: 'Completed',
  failed: 'Failed',
};

const CAMPAIGN_STATUS_ORDER = [
  'draft',
  'queued',
  'processing_script',
  'processing_video',
  'completed',
  'failed',
];

export function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function buildSteps(
  data: Array<{ key: string; name: string; count: number }>,
): FunnelStepData[] {
  return data.map((d, i) => {
    const firstCount = data[0].count;
    const prevCount = i > 0 ? data[i - 1].count : firstCount;
    return {
      name: d.name,
      key: d.key,
      count: d.count,
      dropOffRate: i > 0 ? (1 - safeDiv(d.count, prevCount)) * 100 : null,
      conversionRate: safeDiv(d.count, firstCount) * 100,
    };
  });
}

export async function fetchCampaignLifecycleSteps(
  db: D1Database,
  fromTs: number,
  toTs: number
): Promise<FunnelStepData[]> {
  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  const campaignRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS cnt
       FROM campaigns
       WHERE datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)
       GROUP BY status
       ORDER BY cnt DESC`,
    )
    .bind(fromIso, toIso)
    .all<{ status: string; cnt: number }>();

  const statusMap: Record<string, number> = {};
  for (const r of campaignRows.results ?? []) {
    statusMap[r.status] = Number(r.cnt);
  }

  const funnelCampaignSteps = CAMPAIGN_STATUS_ORDER
    .filter((s) => (statusMap[s] ?? 0) > 0)
    .map((s) => ({
      key: s,
      name: formatStatus(s),
      count: statusMap[s] ?? 0,
    }));

  return buildSteps(
    funnelCampaignSteps.length > 0
      ? funnelCampaignSteps
      : [{ key: 'no_campaigns', name: 'No Campaigns', count: 0 }],
  );
}
