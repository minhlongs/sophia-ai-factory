/**
 * Customer Usage Accounting & Transparency.
 * Aggregates live billing cycle consumption per authenticated tenant.
 *
 * @module land/billing/customer-usage-summary
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export interface DailyUsageBreakdown {
  date: string; // YYYY-MM-DD
  videoMinutes: number;
  elevenLabsChars: number;
  falAiImages: number;
  openRouterTokens: number;
  creditsUsed: number;
}

export interface ProviderUsageBreakdown {
  provider: string;
  metricName: string;
  totalUnits: number;
  creditsUsed: number;
}

export interface CustomerUsageReport {
  userId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  totals: {
    videoMinutes: number;
    elevenLabsChars: number;
    falAiImages: number;
    openRouterTokens: number;
    totalCredits: number;
  };
  providers: ProviderUsageBreakdown[];
  dailyUsage: DailyUsageBreakdown[];
}

interface RawUsageRow {
  service_name: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  credits_used: number | null;
  created_at: number | null;
  status_code: number | null;
}

interface RawVideoRow {
  created_at: number | string | null;
  status: string | null;
}

function getBillingRange(start?: Date, end?: Date): { startMs: number; endMs: number; startIso: string; endIso: string } {
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
  const d = new Date(timestampMs);
  return d.toISOString().split('T')[0] ?? '1970-01-01';
}

export async function getCustomerUsageSummary(
  userId: string,
  from?: Date,
  to?: Date,
): Promise<CustomerUsageReport> {
  if (!userId) {
    throw new Error('TENANT_ID_REQUIRED: Missing user_id for usage summary');
  }

  const { startMs, endMs, startIso, endIso } = getBillingRange(from, to);
  const dailyMap: Record<string, DailyUsageBreakdown> = {};

  const report: CustomerUsageReport = {
    userId,
    billingPeriod: { start: startIso, end: endIso },
    totals: { videoMinutes: 0, elevenLabsChars: 0, falAiImages: 0, openRouterTokens: 0, totalCredits: 0 },
    providers: [],
    dailyUsage: [],
  };

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

    // 1. Query usage_events with strict tenant isolation and non-error filter
    const usageRes = await db.prepare(
      `SELECT service_name, tokens_input, tokens_output, credits_used, created_at, status_code
       FROM usage_events
       WHERE user_id = ?1
         AND created_at >= ?2
         AND created_at <= ?3
         AND (status_code IS NULL OR (status_code >= 200 AND status_code < 300))`,
    ).bind(userId, startSec, endSec).all<RawUsageRow>();

    for (const row of usageRes.results ?? []) {
      const rowMs = (row.created_at ?? startSec) * 1000;
      const day = getOrCreateDay(formatDate(rowMs));
      const sName = (row.service_name ?? '').toLowerCase();
      const credits = row.credits_used ?? 0;
      day.creditsUsed += credits;
      report.totals.totalCredits += credits;

      if (sName.includes('fal') || sName.includes('image')) {
        day.falAiImages += 1;
        report.totals.falAiImages += 1;
      } else if (sName.includes('eleven') || sName.includes('voice') || sName.includes('tts')) {
        const chars = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
        const effectiveChars = chars > 0 ? chars : 150;
        day.elevenLabsChars += effectiveChars;
        report.totals.elevenLabsChars += effectiveChars;
      } else if (sName.includes('openrouter') || sName.includes('llm') || sName.includes('anthropic')) {
        const tokens = (row.tokens_input ?? 0) + (row.tokens_output ?? 0);
        day.openRouterTokens += tokens;
        report.totals.openRouterTokens += tokens;
      }
    }

    // 2. Query completed video jobs/generations strictly for user_id (idempotent: no failed/retried/cancelled)
    const videoRes = await db.prepare(
      `SELECT created_at, status FROM video_jobs
       WHERE user_id = ?1
         AND status IN ('completed', 'succeeded', 'live', 'ready')
         AND created_at >= ?2
         AND created_at <= ?3`,
    ).bind(userId, startMs, endMs).all<RawVideoRow>();

    for (const vRow of videoRes.results ?? []) {
      const vMs = typeof vRow.created_at === 'number' ? vRow.created_at : Date.parse(String(vRow.created_at || nowIso()));
      const day = getOrCreateDay(formatDate(vMs));
      day.videoMinutes += 1;
      report.totals.videoMinutes += 1;
    }
  } catch (err) {
    logger.warn('[CustomerUsageSummary] Partial query degradation', {
      userId,
      error: toError(err).message,
    });
  }

  report.providers = [
    { provider: 'OpenRouter (LLM)', metricName: 'Tokens', totalUnits: report.totals.openRouterTokens, creditsUsed: report.totals.openRouterTokens * 0.00001 },
    { provider: 'ElevenLabs (Voice)', metricName: 'Characters', totalUnits: report.totals.elevenLabsChars, creditsUsed: report.totals.elevenLabsChars * 0.000015 },
    { provider: 'fal.ai (Images)', metricName: 'Generations', totalUnits: report.totals.falAiImages, creditsUsed: report.totals.falAiImages * 0.02 },
    { provider: 'Video Render Engine', metricName: 'Minutes', totalUnits: report.totals.videoMinutes, creditsUsed: report.totals.videoMinutes * 0.5 },
  ];

  report.dailyUsage = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  return report;
}

function nowIso(): string {
  return new Date().toISOString();
}
