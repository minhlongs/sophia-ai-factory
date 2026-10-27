/**
 * Inngest Function: Social Analytics Collector
 * Periodic collector (T+2h, T+6h, T+24h, T+48h, T+7d) for video metrics.
 * Layer: forest/inngest/functions | LOC: < 200 | Zero :any
 * @module forest/inngest/functions/social-analytics-collector
 */

import { inngest } from '@/seed/inngest/client';
import { normalizeVideoMetrics } from '@/tree/analytics/metrics-normalizer';
import { calculateFinancialAttribution } from '@/tree/analytics/roi-calculator';
import { upsertAnalyticsSnapshot } from '@/land/analytics/video-analytics-store';
import {
  fetchMockPlatformMetrics,
  type AnalyticsSyncPayload,
} from './social-analytics-metrics-fetcher';

export { fetchMockPlatformMetrics, type AnalyticsSyncPayload };

interface InngestStepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  sleep: (id: string, duration: string | number) => Promise<void>;
}

export async function processSocialAnalyticsCollector({
  event,
  step,
}: {
  event: { data: unknown };
  step: InngestStepContext;
}): Promise<{ synced: boolean; snapshotId: string; hookScore: number }> {
  const data = event.data as AnalyticsSyncPayload;

  const raw = await step.run('fetch-platform-metrics', async () => {
    return fetchMockPlatformMetrics(data.platform, data.platformPostId);
  });

  const normalized = await step.run('normalize-metrics', async () => {
    return normalizeVideoMetrics(raw);
  });

  const financials = await step.run('calculate-attribution', async () => {
    return calculateFinancialAttribution({
      mcuCost: data.mcuCost ?? 10,
      byokCostUsd: data.byokCostUsd ?? 0.02,
      revenueUsd: data.revenueUsd ?? 0,
    });
  });

  const snapshot = await step.run('persist-snapshot', async () => {
    return upsertAnalyticsSnapshot({
      jobId: data.jobId,
      userId: data.userId,
      channelId: data.channelId,
      platform: data.platform,
      platformPostId: data.platformPostId,
      title: data.title,
      views: raw.views,
      watchTimeSeconds: raw.watchTimeSeconds,
      avgViewDurationSeconds: raw.avgViewDurationSeconds,
      avgViewPercentage: raw.avgViewPercentage,
      threeSecViewRate: normalized.threeSecViewRate,
      completionRate: normalized.completionRate,
      likes: raw.likes,
      comments: raw.comments,
      shares: raw.shares,
      saves: raw.saves,
      hookScore: normalized.hookScore,
      retentionScore: normalized.retentionScore,
      revenueUsd: financials.revenueUsd,
      costMcu: financials.mcuCost,
      costUsd: financials.totalCostUsd,
      netRoiUsd: financials.netMarginUsd,
      banditStatus: normalized.hookScore >= 75 ? 'WINNING_ARM' : 'ACTIVE_ARM',
      recordedAt: Date.now(),
    });
  });

  await step.run('dispatch-flywheel-feedback', async () => {
    await inngest.send({
      name: 'social.analytics.feedback_evaluated',
      data: {
        userId: data.userId,
        tenantId: data.tenantId ?? data.userId,
        jobId: data.jobId,
        platform: data.platform,
        hookScore: normalized.hookScore,
        retentionScore: normalized.retentionScore,
        netRoiUsd: financials.netMarginUsd,
        conversions: financials.revenueUsd > 0 ? 1 : 0,
        revenueUsd: financials.revenueUsd,
        impressions: raw.views,
        costUsd: financials.totalCostUsd,
        // Explicitly labelled: the upstream fetcher returns random fixtures.
        // The feedback dispatcher refuses to persist these as observations.
        isFixture: true,
      },
    });
    return { dispatched: true };
  });

  return { synced: true, snapshotId: snapshot.id, hookScore: normalized.hookScore };
}

export const socialAnalyticsCollectorJob = inngest.createFunction(
  {
    id: 'social-analytics-collector',
    name: 'Social Analytics Collector & Metric Normalizer',
    retries: 3,
  },
  { event: 'social.analytics.sync_requested' },
  processSocialAnalyticsCollector,
);
