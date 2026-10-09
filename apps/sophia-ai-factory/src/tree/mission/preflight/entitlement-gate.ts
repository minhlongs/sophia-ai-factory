/**
 * Production-Safe Mission Preflight Checklist: Entitlement Gate.
 * Layer: tree (domain reusable)
 *
 * @module tree/mission/preflight/entitlement-gate
 */

import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { FailureKind } from '@/seed/types/failure-kind';
import { getBalance } from '@/tree/mcu/credits-repo';
import { MAX_SINGLE_MISSION_COST_CENTS } from './readiness-evaluator';
import type { MissionPreflightOptions, PreflightGateEvaluation } from './types';

export async function evaluateEntitlementGate(
  opts: MissionPreflightOptions,
  resolvedUserId: string
): Promise<PreflightGateEvaluation> {
  // Spike guard: fail-closed if estimated cost exceeds single mission threshold
  if (
    typeof opts.estimatedCostCents === 'number' &&
    opts.estimatedCostCents > 0 &&
    opts.estimatedCostCents > MAX_SINGLE_MISSION_COST_CENTS
  ) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: FailureKind.BILLING_FAILURE,
        message: `Preflight aborted: Estimated cost (${opts.estimatedCostCents}¢) exceeds single mission limit (${MAX_SINGLE_MISSION_COST_CENTS}¢)`,
        details: {
          estimatedCostCents: opts.estimatedCostCents,
          maxCostCents: MAX_SINGLE_MISSION_COST_CENTS,
        },
      },
    };
  }

  let tier = opts.overrides?.tier;
  let mcuBalance = opts.overrides?.mcuBalance;

  try {
    if (!tier) {
      tier = await resolveUserTier(resolvedUserId);
    }
    if (typeof mcuBalance !== 'number') {
      const balance = await getBalance(resolvedUserId);
      mcuBalance = balance.credits_remaining;
    }
  } catch (err) {
    logger.warn('[MissionPreflight] Entitlement check encountered error', {
      userId: resolvedUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    tier = tier ?? 'BASIC';
    mcuBalance = mcuBalance ?? 0;
  }

  // Quota check: user must have remaining MCU balance (> 0) or MASTER tier
  const isMaster = tier === 'MASTER';
  const hasQuota = isMaster || (typeof mcuBalance === 'number' && mcuBalance > 0);

  if (!hasQuota) {
    return {
      passed: false,
      gate: {
        passed: false,
        code: 'INSUFFICIENT_ENTITLEMENT',
        message: `Insufficient MCU balance (${mcuBalance ?? 0} remaining) on tier ${tier}`,
        details: { tier, mcuBalance },
      },
    };
  }

  return {
    passed: true,
    gate: {
      passed: true,
      code: 'ENTITLEMENT_OK',
      message: 'Entitlement and MCU balance verified',
      details: { tier, mcuBalance, estimatedCostCents: opts.estimatedCostCents },
    },
  };
}
