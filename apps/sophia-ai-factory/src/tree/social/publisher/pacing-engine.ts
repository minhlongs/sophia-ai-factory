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

import type { SocialPlatform } from './platform-adapters';

export const CHANNEL_COOLDOWN_MS = 180 * 60 * 1000; // 180 min (3 hours)
export const BASE_JITTER_MS = 45 * 60 * 1000; // 45 min base delay
export const MAX_VARIANCE_MS = 45 * 60 * 1000; // 0-45 min variance (45-90 min total)

export const DAILY_CAPS: Readonly<Record<SocialPlatform, number>> = {
  YOUTUBE_SHORTS: 6,
  TIKTOK_V2: 4,
  INSTAGRAM_REELS: 4,
};

export interface ChannelPacingState {
  readonly platform: SocialPlatform;
  readonly channelId: string;
  readonly todayPublishedCount: number;
  readonly lastPublishedAtMs: number | null;
}

export type PacingReason = 'OK' | 'DAILY_CAP_EXCEEDED' | 'CHANNEL_COOLDOWN_ACTIVE';

export interface PacingDecision {
  readonly allowed: boolean;
  readonly reason: PacingReason;
  readonly delayMs: number;
  readonly scheduledForMs: number;
  readonly dailyCap: number;
  readonly remainingToday: number;
  readonly jitterMs: number;
}

export interface PacingOptions {
  readonly nowMs?: number;
  readonly baseJitterMs?: number;
  readonly maxVarianceMs?: number;
  readonly randomFn?: () => number;
}

export function getDailyCap(platform: SocialPlatform): number {
  return DAILY_CAPS[platform];
}

export function calculateOrganicJitter(options?: {
  baseJitterMs?: number;
  maxVarianceMs?: number;
  randomFn?: () => number;
}): number {
  const base = options?.baseJitterMs ?? BASE_JITTER_MS;
  const variance = options?.maxVarianceMs ?? MAX_VARIANCE_MS;
  const rnd = options?.randomFn ? options.randomFn() : Math.random();
  const clampedRnd = Math.max(0, Math.min(1, rnd));
  return Math.floor(base + clampedRnd * variance);
}

export function isChannelInCooldown(
  lastPublishedAtMs: number | null,
  nowMs: number = Date.now(),
): boolean {
  if (lastPublishedAtMs === null) return false;
  return nowMs - lastPublishedAtMs < CHANNEL_COOLDOWN_MS;
}

export function getEndOfDayMs(timestampMs: number): number {
  const d = new Date(timestampMs);
  d.setUTCHours(23, 59, 59, 999);
  return d.getTime();
}

export function isSameUTCDay(aMs: number, bMs: number): boolean {
  const da = new Date(aMs);
  const db = new Date(bMs);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

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
