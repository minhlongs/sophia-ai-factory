/**
 * Anti-Detection Social Publishing Pacing Engine
 *
 * Enforces:
 * - Strict platform daily caps: TikTok (4), YouTube (6), Instagram (4)
 * - Channel-level cooldown: 180 minutes minimum between posts on same channel
 * - Staggered organic jitter: base 45 min + uniform random variance (45-90 min)
 *
 * Layer: tree/social/publisher (Domain Logic)
 * Max file size: < 200 LOC. Zero :any.
 */

import {
  BASE_JITTER_MS,
  CHANNEL_COOLDOWN_MS,
  DAILY_CAPS,
  MAX_VARIANCE_MS,
  calculateOrganicJitter,
  getDailyCap,
  getEndOfDayMs,
  isChannelInCooldown,
  isSameUTCDay,
  type ChannelPacingState,
  type PacingDecision,
  type PacingOptions,
  type PacingReason,
} from './pacing-helpers';

export {
  BASE_JITTER_MS,
  CHANNEL_COOLDOWN_MS,
  DAILY_CAPS,
  MAX_VARIANCE_MS,
  calculateOrganicJitter,
  getDailyCap,
  getEndOfDayMs,
  isChannelInCooldown,
  isSameUTCDay,
  type ChannelPacingState,
  type PacingDecision,
  type PacingOptions,
  type PacingReason,
};

export function evaluateChannelPacing(
  state: ChannelPacingState,
  options?: PacingOptions,
): PacingDecision {
  const nowMs = options?.nowMs ?? Date.now();
  const cap = getDailyCap(state.platform);

  // Rollover check: If last published date was on a previous UTC day, effective today count is 0
  const isRolledOver = state.lastPublishedAtMs !== null && !isSameUTCDay(state.lastPublishedAtMs, nowMs);
  const effectivePublishedToday = isRolledOver ? 0 : state.todayPublishedCount;
  const remainingToday = Math.max(0, cap - effectivePublishedToday);

  // 1. Daily Cap Check
  if (effectivePublishedToday >= cap) {
    const endOfDay = getEndOfDayMs(nowMs);
    const delayMs = Math.max(1000, endOfDay - nowMs + 1000);
    return {
      allowed: false,
      reason: 'DAILY_CAP_EXCEEDED',
      delayMs,
      scheduledForMs: nowMs + delayMs,
      dailyCap: cap,
      remainingToday: 0,
      jitterMs: 0,
    };
  }

  // 2. Channel Cooldown Check (180 min between posts on same channel)
  if (state.lastPublishedAtMs !== null) {
    const elapsed = nowMs - state.lastPublishedAtMs;
    if (elapsed < CHANNEL_COOLDOWN_MS) {
      const cooldownRemaining = CHANNEL_COOLDOWN_MS - elapsed;
      const jitterMs = calculateOrganicJitter(options);
      const delayMs = cooldownRemaining + jitterMs;
      return {
        allowed: false,
        reason: 'CHANNEL_COOLDOWN_ACTIVE',
        delayMs,
        scheduledForMs: nowMs + delayMs,
        dailyCap: cap,
        remainingToday,
        jitterMs,
      };
    }
  }

  // 3. Allowed with organic jitter
  const jitterMs = calculateOrganicJitter(options);
  return {
    allowed: true,
    reason: 'OK',
    delayMs: jitterMs,
    scheduledForMs: nowMs + jitterMs,
    dailyCap: cap,
    remainingToday,
    jitterMs,
  };
}
