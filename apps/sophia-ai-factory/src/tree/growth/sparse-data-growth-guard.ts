/**
 * REPORT 03 (Track B) & REPORT 10 (Initiative 9):
 * Sparse-Data Growth Guard & Deterministic 3-Second Hook Retention Optimizer
 *
 * Mathematical rationale:
 * - Under sparse creator/affiliate traffic (< 100 verified conversions/month or
 *   < 1,000 impressions/variant), Beta(alpha, beta) posteriors in Thompson Sampling
 *   stay wide and Half-Kelly f* = (bp - q)/(2b) amplifies estimation noise.
 * - Default to Static Publishing Schedule (first 30 days) + Deterministic Rule-Based
 *   3s-Hook Retention Pruning (after 72h and >= 1,000 views, drop bottom 25% hooks).
 *
 * Layer: tree (domain reusable logic)
 * @module tree/growth/sparse-data-growth-guard
 */

export const MIN_VERIFIED_CONVERSIONS_PER_MONTH = 100;
export const MIN_IMPRESSIONS_PER_VARIANT = 1000;
export const STATIC_SCHEDULE_WARMUP_DAYS = 30;
export const HOOK_EVALUATION_MIN_HOURS = 72;
export const HOOK_EVALUATION_MIN_VIEWS = 1000;
export const HOOK_PRUNE_BOTTOM_QUANTILE = 0.25;

export type GrowthOptimizationMode = 'deterministic_rule_based' | 'thompson_half_kelly';

export interface SparseDataGateInput {
  readonly monthlyVerifiedConversions: number;
  readonly variantImpressions: readonly number[];
  readonly accountAgeDays?: number;
}

export interface SparseDataGateDecision {
  readonly mode: GrowthOptimizationMode;
  readonly allowThompsonSampling: boolean;
  readonly allowHalfKellyAllocation: boolean;
  readonly enforceStaticSchedule: boolean;
  readonly reason: string;
  readonly minVariantImpressions: number;
  readonly monthlyVerifiedConversions: number;
}

export interface HookRetentionVariant {
  readonly variantId: string;
  readonly hookPatternId: string;
  readonly views: number;
  readonly threeSecondHookRate: number; // 0..1 (e.g. 0.42 = 42% 3s view rate)
  readonly elapsedHours: number;
}

export interface HookPruningResult {
  readonly keptVariantIds: readonly string[];
  readonly prunedVariantIds: readonly string[];
  readonly pendingEvaluationVariantIds: readonly string[];
  readonly cutoffHookRate: number | null;
}

/**
 * Evaluates whether a tenant/channel has sufficient conversion and impression density
 * to graduate from deterministic rule-based optimization to Thompson Sampling + Half-Kelly.
 */
export function evaluateSparseDataGrowthGate(input: SparseDataGateInput): SparseDataGateDecision {
  const conversions = Math.max(0, Math.floor(input.monthlyVerifiedConversions || 0));
  const impressionsList = Array.isArray(input.variantImpressions) ? input.variantImpressions : [];
  const minVariantImpressions =
    impressionsList.length > 0 ? Math.min(...impressionsList.map((n) => Math.max(0, Math.floor(n || 0)))) : 0;
  const accountAgeDays = typeof input.accountAgeDays === 'number' ? input.accountAgeDays : STATIC_SCHEDULE_WARMUP_DAYS;

  const inWarmupWindow = accountAgeDays < STATIC_SCHEDULE_WARMUP_DAYS;
  const conversionsSufficient = conversions >= MIN_VERIFIED_CONVERSIONS_PER_MONTH;
  const impressionsSufficient =
    impressionsList.length >= 2 && minVariantImpressions >= MIN_IMPRESSIONS_PER_VARIANT;

  if (inWarmupWindow || !conversionsSufficient || !impressionsSufficient) {
    const reasons: string[] = [];
    if (inWarmupWindow) {
      reasons.push(`account warmup (${accountAgeDays}d < ${STATIC_SCHEDULE_WARMUP_DAYS}d static schedule window)`);
    }
    if (!conversionsSufficient) {
      reasons.push(`sparse conversions (${conversions} < ${MIN_VERIFIED_CONVERSIONS_PER_MONTH}/month)`);
    }
    if (!impressionsSufficient) {
      reasons.push(`sparse variant impressions (${minVariantImpressions} < ${MIN_IMPRESSIONS_PER_VARIANT}/variant)`);
    }

    return {
      mode: 'deterministic_rule_based',
      allowThompsonSampling: false,
      allowHalfKellyAllocation: false,
      enforceStaticSchedule: inWarmupWindow,
      reason: `Hold Thompson Sampling & Half-Kelly: ${reasons.join('; ')}`,
      minVariantImpressions,
      monthlyVerifiedConversions: conversions,
    };
  }

  return {
    mode: 'thompson_half_kelly',
    allowThompsonSampling: true,
    allowHalfKellyAllocation: true,
    enforceStaticSchedule: false,
    reason: 'Statistical density threshold met (>=100 conversions/mo and >=1,000 impressions/variant)',
    minVariantImpressions,
    monthlyVerifiedConversions: conversions,
  };
}

/**
 * Deterministic Rule-Based Optimization:
 * After 72 hours and >= 1,000 views, prunes the bottom 25% of hook patterns by 3-second view rate.
 */
export function pruneBottomHookRetentionVariants(
  variants: readonly HookRetentionVariant[],
): HookPruningResult {
  const pendingEvaluationVariantIds: string[] = [];
  const eligible: HookRetentionVariant[] = [];

  for (const v of variants) {
    if (v.elapsedHours >= HOOK_EVALUATION_MIN_HOURS && v.views >= HOOK_EVALUATION_MIN_VIEWS) {
      eligible.push(v);
    } else {
      pendingEvaluationVariantIds.push(v.variantId);
    }
  }

  if (eligible.length < 4) {
    return {
      keptVariantIds: eligible.map((v) => v.variantId),
      prunedVariantIds: [],
      pendingEvaluationVariantIds,
      cutoffHookRate: null,
    };
  }

  const sortedAsc = [...eligible].sort((a, b) => {
    if (a.threeSecondHookRate !== b.threeSecondHookRate) {
      return a.threeSecondHookRate - b.threeSecondHookRate;
    }
    return a.variantId.localeCompare(b.variantId);
  });

  const pruneCount = Math.max(1, Math.floor(sortedAsc.length * HOOK_PRUNE_BOTTOM_QUANTILE));
  const pruned = sortedAsc.slice(0, pruneCount);
  const kept = sortedAsc.slice(pruneCount);
  const cutoffHookRate = pruned[pruned.length - 1]?.threeSecondHookRate ?? null;

  return {
    keptVariantIds: kept.map((v) => v.variantId),
    prunedVariantIds: pruned.map((v) => v.variantId),
    pendingEvaluationVariantIds,
    cutoffHookRate,
  };
}
