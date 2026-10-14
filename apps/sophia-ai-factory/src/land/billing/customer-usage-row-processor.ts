/**
 * Usage row and video job aggregation helpers for customer-usage-summary.
 * @module land/billing/customer-usage-row-processor
 */

import type { createServerClient } from '@/seed/db/client';
import { TOPUP_PRICE_PER_MCU } from '@/seed/config/tiers/tier-configs';
import type {
  DailyUsageBreakdown,
  ProviderUsageBreakdown,
} from './customer-usage-types';

export interface RawUsageRow {
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

export interface RawVideoRow {
  id?: string | null;
  created_at: number | string | null;
  status: string | null;
}

export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().split('T')[0] ?? '1970-01-01';
}

export function processUsageRow(
  row: RawUsageRow,
  seenEventKeys: Set<string>,
  getOrCreateDay: (d: string) => DailyUsageBreakdown,
  totals: {
    videoMinutes: number;
    elevenLabsChars: number;
    falAiImages: number;
    openRouterTokens: number;
    totalCredits: number;
  },
  startSec: number,
) {
  const dedupKey = row.idempotency_key || row.request_id || (row.id ? `id_${row.id}` : null);
  if (dedupKey) {
    if (seenEventKeys.has(dedupKey)) return;
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

export async function ingestCompletedVideos(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  startMs: number,
  endMs: number,
  startSec: number,
  seenVideoIds: Set<string>,
  getOrCreateDay: (d: string) => DailyUsageBreakdown,
  totals: { videoMinutes: number; totalCredits: number },
) {
  const videoRes = await db
    .prepare(
      `SELECT id, created_at, status FROM video_jobs
     WHERE user_id = ?1
       AND status IN ('completed', 'succeeded', 'live', 'ready', 'uploaded', 'published')
       AND created_at >= ?2
       AND created_at <= ?3`,
    )
    .bind(userId, startMs, endMs)
    .all<RawVideoRow>();

  for (const vRow of videoRes.results ?? []) {
    if (vRow.id) {
      if (seenVideoIds.has(vRow.id)) continue;
      seenVideoIds.add(vRow.id);
    }
    const vMs =
      typeof vRow.created_at === 'number'
        ? vRow.created_at < 1e11
          ? vRow.created_at * 1000
          : vRow.created_at
        : Date.parse(String(vRow.created_at || startSec * 1000));
    const day = getOrCreateDay(formatDate(vMs));
    day.videoMinutes += 1;
    totals.videoMinutes += 1;
  }
}

export function buildProviderUsageBreakdown(totals: {
  openRouterTokens: number;
  elevenLabsChars: number;
  falAiImages: number;
  videoMinutes: number;
}): ProviderUsageBreakdown[] {
  return [
    { provider: 'OpenRouter (LLM)', metricName: 'Tokens', totalUnits: totals.openRouterTokens, creditsUsed: totals.openRouterTokens * 0.00001, estimatedCostUsd: Math.round(totals.openRouterTokens * 0.00001 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'ElevenLabs (Voice)', metricName: 'Characters', totalUnits: totals.elevenLabsChars, creditsUsed: totals.elevenLabsChars * 0.000015, estimatedCostUsd: Math.round(totals.elevenLabsChars * 0.000015 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'fal.ai (Images)', metricName: 'Generations', totalUnits: totals.falAiImages, creditsUsed: totals.falAiImages * 0.02, estimatedCostUsd: Math.round(totals.falAiImages * 0.02 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'BYOK' },
    { provider: 'Video Render Engine', metricName: 'Minutes', totalUnits: totals.videoMinutes, creditsUsed: totals.videoMinutes * 0.5, estimatedCostUsd: Math.round(totals.videoMinutes * 0.5 * TOPUP_PRICE_PER_MCU * 100) / 100, costClassification: 'METERED' },
  ];
}
