/**
 * Cost guardrail for video generation.
 *
 * Pre-checks the user's MCU balance against the estimated cost of a video
 * job BEFORE we kick off any expensive upstream calls (HeyGen, MuAPI, fly).
 *
 * 1 MCU credit ≈ $0.10 (the conversion is owned by the credits engine; we
 * keep the ratio in one place here so future re-pricing is a single edit).
 *
 * Estimated cost is conservative: TTS + visual + compose ≈ stage cost ledger
 * upper bound. Actual bill happens via cost-ledger after each stage.
 *
 * @module lib/video/cost-guardrail
 */

import { getTotalCredits } from '@/tree/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';

export type RenderPath = 'path-a' | 'path-b' | 'template';

/** Estimated USD cost per render path — kept conservative (slight overestimate). */
const PATH_COST_USD: Record<RenderPath, number> = {
  template: 0.06,    // template render only
  'path-a': 0.18,    // tts + simple visual + compose
  'path-b': 0.55,    // tts + cinematic visual + compose
};

/** Conversion rate from USD to MCU credits. */
const USD_PER_CREDIT = 0.10;

export interface GuardrailResult {
  allowed: boolean;
  estimatedCostUsd: number;
  estimatedCredits: number;
  creditsRemaining: number;
  reason?: 'insufficient_credits';
  hint?: string;
}

/**
 * Check whether a user has enough MCU credits for the given render path.
 * Returns `{allowed: false, reason}` to short-circuit the pipeline before
 * upstream cost is incurred.
 */
export async function checkVideoBudget(
  userId: string,
  path: RenderPath,
): Promise<GuardrailResult> {
  const estimatedCostUsd = PATH_COST_USD[path];
  const estimatedCredits = Math.ceil(estimatedCostUsd / USD_PER_CREDIT);

  let creditsRemaining = 0;
  try {
    const total = await getTotalCredits(userId);
    creditsRemaining = total.total;
  } catch (err) {
    // Defensive: if balance lookup fails, deny the job rather than risk
    // unbilled work. Caller can retry once telemetry is healthy.
    logger.warn('[CostGuardrail] balance lookup failed — denying job', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      allowed: false,
      estimatedCostUsd,
      estimatedCredits,
      creditsRemaining: 0,
      reason: 'insufficient_credits',
      hint: 'Could not verify balance — please retry.',
    };
  }

  if (creditsRemaining < estimatedCredits) {
    return {
      allowed: false,
      estimatedCostUsd,
      estimatedCredits,
      creditsRemaining,
      reason: 'insufficient_credits',
      hint: `Need ${estimatedCredits} credits, have ${creditsRemaining}. Top up to continue.`,
    };
  }

  return {
    allowed: true,
    estimatedCostUsd,
    estimatedCredits,
    creditsRemaining,
  };
}
