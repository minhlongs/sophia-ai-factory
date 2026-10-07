/**
 * Multi-Platform Social Syndication Pacer
 *
 * Enforces intelligent staggered pacing (45-90 min intervals),
 * daily upload caps (max 4/day), and channel-level cooldowns (3 hours)
 * to maximize organic reach and prevent shadowbans.
 *
 * Layer: tree/social/syndication (Domain Logic)
 * @module tree/social/syndication/social-syndication-pacer
 */

import type {
  ChannelPublishState,
  SyndicationPacingResult,
} from './syndication-pacing-types';

export const MAX_DAILY_UPLOADS = 4;
export const MIN_CHANNEL_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

export function evaluateSyndicationPacing(
  state: ChannelPublishState,
  nowMs: number = Date.now(),
): SyndicationPacingResult {
  // 1. Check daily hard quota
  if (state.todayPublishedCount >= MAX_DAILY_UPLOADS) {
    const endOfDayMs = new Date(nowMs).setHours(23, 59, 59, 999);
    return {
      allowed: false,
      delayMs: Math.max(0, endOfDayMs - nowMs),
      reason: 'MAX_DAILY_QUOTA_REACHED',
      nextAvailableAtMs: endOfDayMs + 1000,
    };
  }

  // 2. Check channel cooldown interval (3 hours between uploads)
  if (state.lastPublishedAtMs !== null) {
    const elapsedMs = nowMs - state.lastPublishedAtMs;
    if (elapsedMs < MIN_CHANNEL_INTERVAL_MS) {
      const remainingCooldownMs = MIN_CHANNEL_INTERVAL_MS - elapsedMs;
      return {
        allowed: false,
        delayMs: remainingCooldownMs,
        reason: 'MIN_INTERVAL_NOT_MET',
        nextAvailableAtMs: nowMs + remainingCooldownMs,
      };
    }
  }

  // 3. Staggered organic pacing (45-90 minutes + randomized jitter)
  const baseMinutes = 45;
  const countMultiplier = Math.min(state.todayPublishedCount * 15, 45); // up to +45 min
  const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000); // 0-5 min jitter
  const totalDelayMs = (baseMinutes + countMultiplier) * 60 * 1000 + jitterMs;

  return {
    allowed: true,
    delayMs: totalDelayMs,
    reason: 'STAGGERED_OK',
    nextAvailableAtMs: nowMs + totalDelayMs,
  };
}
