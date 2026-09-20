/**
 * Pre-Flight Balance & Tier Verification Service
 *
 * Layer: forest (workflow coordination, tier lookup, balance retrieval)
 * Dependencies: @/seed/types/creator-marketplace, @/seed/db/get-user-tier,
 *               @/tree/mcu/credits-repo, @/tree/marketplace/preflight-cost-engine
 *
 * @module forest/marketplace/preflight-check
 */

import type {
  VideoCostParams,
  PreflightCheckResult,
} from '@/seed/types/creator-marketplace';
import { estimateBlueprintStudioCost } from '@/tree/marketplace/preflight-cost-engine';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getBalance } from '@/tree/mcu/credits-repo';

/**
 * Verifies if user has sufficient MCU balance and subscription permissions
 * to launch or clone a video blueprint mission.
 */
export async function verifyUserPreflightMcu(
  userId: string,
  params: VideoCostParams,
): Promise<PreflightCheckResult> {
  const breakdown = estimateBlueprintStudioCost(
    params.scenes ?? 5,
    params.durationSeconds ?? 30,
    params.trackCount ?? 3,
    params.resolution ?? '1080p',
    params.modelSelection,
  );

  // 1. Hard cost spike ceiling protection ($5.00 / 5,000 MCU)
  if (breakdown.isCeilingExceeded) {
    return {
      allowed: false,
      requiredMcu: breakdown.totalMCU,
      currentMcu: 0,
      estimatedUsd: breakdown.estimatedUsd,
      isCeilingExceeded: true,
      userTier: 'UNKNOWN',
      breakdown,
      error: 'COST_SPIKE_CEILING_EXCEEDED',
    };
  }

  // 2. Resolve user subscription tier
  const userTier = await getUserTier(userId).catch(() => 'BASIC');

  // 3. MASTER tier bypasses credit limits (unlimited lifetime allowance)
  if (userTier === 'MASTER') {
    return {
      allowed: true,
      requiredMcu: breakdown.totalMCU,
      currentMcu: 100000,
      estimatedUsd: breakdown.estimatedUsd,
      isCeilingExceeded: false,
      userTier,
      breakdown,
    };
  }

  // 4. Retrieve current MCU balance
  let currentMcu = 0;
  try {
    const bal = await getBalance(userId);
    currentMcu = bal.credits_remaining;
  } catch {
    currentMcu = 0;
  }

  // 5. Balance sufficiency check
  const isAllowed = currentMcu >= breakdown.totalMCU;
  const missingMcu = isAllowed ? undefined : breakdown.totalMCU - currentMcu;

  return {
    allowed: isAllowed,
    requiredMcu: breakdown.totalMCU,
    currentMcu,
    estimatedUsd: breakdown.estimatedUsd,
    missingMcu,
    isCeilingExceeded: false,
    userTier,
    breakdown,
    error: isAllowed ? undefined : 'INSUFFICIENT_MCU_BALANCE',
  };
}
