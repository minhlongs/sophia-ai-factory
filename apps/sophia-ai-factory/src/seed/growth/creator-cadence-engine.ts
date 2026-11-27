/**
 * Creator Daily Mission Autopilot & Anti-Burnout Publishing Cadence Engine.
 *
 * Clean-room pure-TS engine (MIT patterns from pendpost/pendpost,
 * htekdev/late-social-mcp, and jsjoeio/use-streak):
 * - Enforces burst-deferring daily cadence caps to prevent platform spam bans.
 * - Tracks anti-burnout publishing streak with built-in rest-day grace tokens.
 *
 * Layer: seed/growth (pure deterministic state machine, zero deps)
 *
 * @module seed/growth/creator-cadence-engine
 */

export interface CadenceInput {
  readonly postsToday: number;
  readonly dailyCap: number;
  readonly currentStreakDays: number;
  readonly graceTokensRemaining: number;
  readonly actionBlockTripped: boolean;
}

export interface CadenceDecision {
  readonly status: 'ready' | 'defer_burst' | 'paused_circuit_breaker';
  readonly remainingSlotsToday: number;
  readonly burnoutRisk: 'low' | 'medium' | 'high';
  readonly recommendation: string;
}

export function evaluateCreatorCadence(input: CadenceInput): CadenceDecision {
  if (input.actionBlockTripped) {
    return {
      status: 'paused_circuit_breaker',
      remainingSlotsToday: 0,
      burnoutRisk: 'high',
      recommendation: 'Platform action-block breaker tripped. Manual review required before resuming.',
    };
  }

  const safeCap = Math.max(1, Math.min(10, Math.round(input.dailyCap)));
  const remaining = Math.max(0, safeCap - Math.max(0, input.postsToday));

  if (remaining === 0) {
    return {
      status: 'defer_burst',
      remainingSlotsToday: 0,
      burnoutRisk: input.postsToday >= 5 ? 'high' : 'medium',
      recommendation: 'Daily cadence cap reached. Defer extra drafts to tomorrow’s optimal window.',
    };
  }

  const burnoutRisk =
    input.currentStreakDays >= 14 && input.graceTokensRemaining === 0
      ? 'high'
      : input.currentStreakDays >= 7
        ? 'medium'
        : 'low';

  return {
    status: 'ready',
    remainingSlotsToday: remaining,
    burnoutRisk,
    recommendation: `Safe to publish ${remaining} more post(s) today.`,
  };
}
