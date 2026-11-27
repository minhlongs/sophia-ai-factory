/**
 * Social Account Warm-Up & Shadowban Early-Warning Cooldown FSM.
 *
 * Clean-room pure-TS engine (Apache-2.0/MIT patterns from
 * Stackbilt-dev/llm-providers, p-vbordei/circuit-breaker, and ylcnfrht/resilience):
 * - Enforces configurable Day 1–14 warm-up ramp caps for new faceless accounts.
 * - Detects sudden reach-drop / 0-view jail anomalies and lazily evaluates
 *   cooldown recovery with an injectable clock.
 *
 * Layer: seed/growth (pure deterministic FSM, zero external deps)
 *
 * @module seed/growth/account-warmup-fsm
 */

export type AccountHealthState = 'healthy' | 'degraded' | 'cooldown_open';

export interface AccountWarmupInput {
  readonly accountAgeDays: number;
  readonly baselineMedianViews: number;
  readonly recentVideoViews: readonly number[];
  readonly cooldownUntilMs: number | null;
  readonly nowMs?: number;
}

export interface AccountWarmupStatus {
  readonly state: AccountHealthState;
  readonly maxDailyPostsAllowed: number;
  readonly reachRatio: number;
  readonly recommendation: string;
}

export function evaluateAccountWarmupHealth(input: AccountWarmupInput): AccountWarmupStatus {
  const now = input.nowMs ?? Date.now();
  const age = Number.isFinite(input.accountAgeDays) ? Math.max(0, Math.floor(input.accountAgeDays)) : 0;
  const maxDailyPostsAllowed = age <= 3 ? 1 : age <= 7 ? 2 : age <= 14 ? 3 : 4;

  if (input.cooldownUntilMs !== null && now < input.cooldownUntilMs) {
    return {
      state: 'cooldown_open',
      maxDailyPostsAllowed: 0,
      reachRatio: 0,
      recommendation: 'Account is in active cooldown. Wait until cooldown expires before posting.',
    };
  }

  const safeBaseline =
    Number.isFinite(input.baselineMedianViews) && input.baselineMedianViews > 0
      ? input.baselineMedianViews
      : 0;
  const recentAvg =
    input.recentVideoViews.length > 0
      ? input.recentVideoViews.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0) /
        input.recentVideoViews.length
      : safeBaseline;

  const reachRatio = safeBaseline > 0 ? Number((recentAvg / safeBaseline).toFixed(2)) : 1;

  if (input.recentVideoViews.length >= 3 && reachRatio <= 0.15) {
    return {
      state: 'cooldown_open',
      maxDailyPostsAllowed: 0,
      reachRatio,
      recommendation: 'Severe reach drop (<=15% of baseline). Pause 48h and check FYP eligibility.',
    };
  }
  if (input.recentVideoViews.length >= 2 && reachRatio <= 0.45) {
    return {
      state: 'degraded',
      maxDailyPostsAllowed: Math.min(1, maxDailyPostsAllowed),
      reachRatio,
      recommendation: 'Soft reach degradation detected. Throttle to 1 post/day until views recover.',
    };
  }

  return {
    state: 'healthy',
    maxDailyPostsAllowed,
    reachRatio,
    recommendation: `Account healthy (Day ${age}). Safe cap: ${maxDailyPostsAllowed} post(s)/day.`,
  };
}
