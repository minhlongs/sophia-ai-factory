/**
 * Unit Economics Submodule: Provider Cost Aggregator.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/provider-cost-aggregator
 */

import type {
  EconomicsProviderId,
  ProviderCostItem,
} from '@/seed/types/unit-economics-types';
import type { ProviderStatsBucket } from './types';

/**
 * Classifies model identifier to provider ID.
 */
export function classifyProvider(model: string): EconomicsProviderId {
  const modelLower = (model || '').toLowerCase();
  if (modelLower.includes('fal') || modelLower.includes('flux')) {
    return 'fal';
  }
  if (modelLower.includes('eleven') || modelLower.includes('tts')) {
    return 'elevenlabs';
  }
  if (
    modelLower.includes('mekong') ||
    modelLower.includes('apple_m1') ||
    modelLower.includes('edge')
  ) {
    return 'mekong';
  }
  return 'openrouter';
}

export const PROVIDER_DISPLAY_NAMES: Record<EconomicsProviderId, string> = {
  fal: 'fal.ai (Flux Schnell / Dev)',
  elevenlabs: 'ElevenLabs Neural TTS',
  openrouter: 'OpenRouter (DeepSeek / GPT-4o-mini)',
  mekong: 'Mekong GPU Edge (Apple M1 Max)',
};

export const DEFAULT_AVG_LATENCIES: Record<EconomicsProviderId, number> = {
  fal: 1400,
  elevenlabs: 650,
  openrouter: 820,
  mekong: 380,
};

/**
 * Builds detailed ProviderCostItem array from aggregated provider stats buckets.
 */
export function buildProviderCosts(
  providerCounts: Record<EconomicsProviderId, ProviderStatsBucket>,
  totalCogsCents: number
): ProviderCostItem[] {
  const providers: EconomicsProviderId[] = ['fal', 'elevenlabs', 'openrouter', 'mekong'];
  const totalSafeCogsCents = Math.max(1, totalCogsCents);

  return providers.map((pid) => {
    const bucket = providerCounts[pid];
    const totalCostUsd = pid === 'mekong' ? 0.0 : Number((bucket.costCents / 100).toFixed(2));
    const avgCostPerJobUsd =
      pid === 'mekong' || bucket.jobs === 0
        ? 0.0
        : Number((bucket.costCents / 100 / bucket.jobs).toFixed(4));
    const costSharePct =
      pid === 'mekong'
        ? 0.0
        : Number(((bucket.costCents / totalSafeCogsCents) * 100).toFixed(1));
    const failureRatePct =
      bucket.jobs > 0
        ? Number((((bucket.jobs - bucket.success) / bucket.jobs) * 100).toFixed(1))
        : 0;
    const avgLatencyMs =
      bucket.jobs > 0
        ? Math.round(bucket.latencyTotal / bucket.jobs)
        : DEFAULT_AVG_LATENCIES[pid];

    return {
      provider: pid,
      displayName: PROVIDER_DISPLAY_NAMES[pid],
      totalJobs: bucket.jobs,
      successfulJobs: bucket.success,
      failedJobs: bucket.jobs - bucket.success,
      totalCostUsd,
      avgCostPerJobUsd,
      costSharePct,
      failureRatePct,
      avgLatencyMs,
    };
  });
}

/**
 * Builds high-level provider breakdown summary.
 */
export function buildProviderBreakdown(
  providerCounts: Record<EconomicsProviderId, ProviderStatsBucket>,
  totalCogsCents: number
): { provider: EconomicsProviderId; totalCostUsd: number; percentageOfTotal: number }[] {
  const providers: EconomicsProviderId[] = ['fal', 'elevenlabs', 'openrouter', 'mekong'];
  const totalSafeCogsCents = Math.max(1, totalCogsCents);

  return providers.map((pid) => {
    const costUsd = Number((providerCounts[pid].costCents / 100).toFixed(2));
    const percentageOfTotal = Number(
      ((providerCounts[pid].costCents / totalSafeCogsCents) * 100).toFixed(1)
    );
    return {
      provider: pid,
      totalCostUsd: costUsd,
      percentageOfTotal,
    };
  });
}
