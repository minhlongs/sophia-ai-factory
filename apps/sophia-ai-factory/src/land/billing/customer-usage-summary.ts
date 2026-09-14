/**
 * Customer Usage Accounting & Transparency.
 * Aggregates live billing cycle consumption per authenticated tenant with full plan transparency.
 *
 * @module land/billing/customer-usage-summary
 */

import { createServerClient } from '@/seed/db/client';
import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resolveCustomerPlan, calculateOverageAndRemaining } from './customer-usage-plan';
import type {
  CustomerUsageReport,
  DailyUsageBreakdown,
  ProviderUsageBreakdown,
} from './customer-usage-types';

export * from './customer-usage-types';

interface RawUsageRow {
  id?: string | null;
  service_name: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  credits_used: number | null;
  created_at: number | null;
  status_code: number | null;
  idempotency_key?: string | null;
  request_id?: string | null;
}

interface RawVideoRow {
  id?: string | null;
  created_at: number | string | null;
  status: string | null;
}

function getBillingRange(start?: Date, end?: Date) {
  const now = new Date();
  const s = start ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const e = end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    startMs: Math.floor(s.getTime()),
    endMs: Math.floor(e.getTime()),
    startIso: s.toISOString(),
    endIso: e.toISOString(),
  };
}

function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split('T')[0] ?? '1970-01-01';
}

function processUsageRow(
  row: RawUsageRow,
  seenEventKeys: Set<string>,
  getOrCreateDay: (d: string) => DailyUsageBreakdown,
  totals: { videoMinutes: number; elevenLabsChars: number; falAiImages: number; openRouterTokens: number; totalCredits: number },
  startSec: number,
) {
  const dedupKey = row.idempotency_key || row.request_id || (row.id ? `id_${row.id}` : null);
  if (dedupKey) {
    if (seenEventKeys.has(dedupKey)) return; // Drop duplicate event
    seenEventKeys.add(dedupKey);
  }

  const rowMs = (row.created_at ?? startSec) * 1000;
  const day = getOrCreateDay(formatDate(rowMs));
  const sName = (row.service_name ?? '').toLowerCase();
  const credits = row.credits_used ?? 0;
  day.creditsUsed += credits;
  totals.totalCredits += credits;

  if (sName.includes('fal') || sName.includes('image')) {
    day.falAiImages += 1;
    totals.falAiImages += 1;
  } else if (sName.includes('eleven') || sName.includes('voice') || sName.includes('tts')) {
    const chars = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
    const effectiveChars = chars > 0 ? chars : 150;
    day.elevenLabsChars += effectiveChars;
    totals.elevenLabsChars += effectiveChars;
  } else if (sName.includes('openrouter') || sName.includes('llm') || sName.includes('anthropic')) {
    const tokens = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
    day.openRouterTokens += tokens;
    totals.openRouterTokens += tokens;
  }
}

export async function getCustomerUsageSummary(
  userId: string,
  from?: Date,
  to?: Date,
): Promise<CustomerUsageReport> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('TENANT_ID_REQUIRED: Missing user_id for usage summary');
  }

  const { startMs, endMs, startIso, endIso } = getBillingRange(from, to);
  const dailyMap: Record<string, DailyUsageBreakdown> = {};
  const seenEventKeys = new Set<string>();
  const seenVideoIds = new Set<string>();

  const totals = { videoMinutes: 0, elevenLabsChars: 0, falAiImages: 0, openRouterTokens: 0, totalCredits: 0 };

  const getOrCreateDay = (d: string): DailyUsageBreakdown => {
    if (!dailyMap[d]) {
      dailyMap[d] = { date: d, videoMinutes: 0, elevenLabsChars: 0, falAiImages: 0, openRouterTokens: 0, creditsUsed: 0 };
    }
    return dailyMap[d];
  };

  try {
    const db = createServerClient();
    const startSec = Math.floor(startMs / 1000);
    const endSec = Math.floor(endMs / 1000);

    // 1. Query usage_events with strict tenant isolation, non-error status, and deduplication
    const usageRes = await db.prepare(
      `SELECT id, service_name, tokens_input, tokens_output, credits_used, created_at, status_code, idempotency_key, request_id
       FROM usage_events
       WHERE user_id = ?1
         AND created_at >= ?2
         AND created_at <= ?3
         AND (status_code IS NULL OR (status_code >= 200 AND status_code < 300))`,
    ).bind(userId, startSec, endSec).all<RawUsageRow>();

    for (const row of usageRes.results ?? []) {
      processUsageRow(row, seenEventKeys, getOrCreateDay, totals, startSec);
    }

    // 2. Query completed video jobs/generations strictly for user_id (idempotent, no failed/retried/cancelled)
    await ingestCompletedVideos(db, userId, startMs, endMs, startSec, seenVideoIds, getOrCreateDay, totals);
  } catch (err) {
    logger.warn('[CustomerUsageSummary] Partial query degradation', { userId, error: toError(err).message });
  }

  // 3. Resolve plan, limits, overage, and next billing event
  const { plan, limit, nextBillingEvent } = await resolveCustomerPlan(userId, endIso);
  const { percentUsed, remaining, overage } = calculateOverageAndRemaining(totals.totalCredits, limit.mcuMonthly);

  const providers: ProviderUsageBreakdown[] = [
    { provider: 'OpenRouter (LLM)', metricName: 'Tokens', totalUnits: totals.openRouterTokens, creditsUsed: totals.openRouterTokens * 0.00001, estimatedCostUsd: Math.round(totals.openRouterTokens * 0.00001 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'ElevenLabs (Voice)', metricName: 'Characters', totalUnits: totals.elevenLabsChars, creditsUsed: totals.elevenLabsChars * 0.000015, estimatedCostUsd: Math.round(totals.elevenLabsChars * 0.000015 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'fal.ai (Images)', metricName: 'Generations', totalUnits: totals.falAiImages, creditsUsed: totals.falAiImages * 0.02, estimatedCostUsd: Math.round(totals.falAiImages * 0.02 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'Video Render Engine', metricName: 'Minutes', totalUnits: totals.videoMinutes, creditsUsed: totals.videoMinutes * 0.5, estimatedCostUsd: Math.round(totals.videoMinutes * 0.5 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'METERED' },
  ];

  return {
    userId,
    billingPeriod: { start: startIso, end: endIso },
    plan,
    limit,
    usage: { ...totals, mcuUsed: totals.totalCredits, percentUsed },
    remaining,
    overage,
    nextBillingEvent,
    totals,
    providers,
    dailyUsage: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function ingestCompletedVideos(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  startMs: number,
  endMs: number,
  startSec: number,
  seenVideoIds: Set<string>,
  getOrCreateDay: (d: string) => DailyUsageBreakdown,
  totals: { videoMinutes: number; totalCredits: number },
) {
  const videoRes = await db.prepare(
    `SELECT id, created_at, status FROM video_jobs
     WHERE user_id = ?1
       AND status IN ('completed', 'succeeded', 'live', 'ready', 'uploaded', 'published')
       AND created_at >= ?2
       AND created_at <= ?3`,
  ).bind(userId, startMs, endMs).all<RawVideoRow>();

  for (const vRow of videoRes.results ?? []) {
    if (vRow.id) {
      if (seenVideoIds.has(vRow.id)) continue;
      seenVideoIds.add(vRow.id);
    }
    const vMs = typeof vRow.created_at === 'number' ? (vRow.created_at < 1e11 ? vRow.created_at * 1000 : vRow.created_at) : Date.parse(String(vRow.created_at || (startSec * 1000)));
    const day = getOrCreateDay(formatDate(vMs));
    day.videoMinutes += 1;
    totals.videoMinutes += 1;
  }
}
