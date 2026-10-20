/**
 * risk-scorer.ts — Pure fraud scoring for affiliate referral clicks.
 *
 * `computeRiskVerdict` combines three rules as a weighted sum, so the composite
 * stays inside 0..1 and reaches the suspicious threshold only when the rules
 * agree: duplicate clicks inside a 60s window, click velocity over 20/hour with
 * fewer than 3 distinct user agents, and missing or non-human user agents.
 *
 * Deliberately pure: it scores an already-materialised click window and never
 * touches a database, never logs a raw IP, and never reads a user agent beyond
 * counting distinct values. Fetching the window and writing the verdict is the
 * nightly job's responsibility.
 *
 * Layer: tree (domain-reusable primitive) rather than land, because scoring
 * policy is not billing or payout logic — the nightly forest job consumes it.
 *
 * @module tree/affiliates/risk-scorer
 */

import { isBotUserAgent, normaliseUserAgent } from './user-agent-bot-detect';
import {
  RISK_THRESHOLDS,
  RISK_WEIGHTS,
  type ClickSample,
  type PartnerStatusLike,
  type RiskVerdict,
  type RuleReason,
  type RuleSignal,
} from './risk-score-types';

export type { ClickSample, PartnerStatusLike, RiskVerdict, RuleReason, RuleSignal };
export { RISK_THRESHOLDS, RISK_WEIGHTS };

/**
 * Clamp to 0..1 and round to 2 decimals.
 *
 * Rounding matters because the stored score is compared against the threshold
 * and a floating-point tail like 0.5000000000000001 must not read as suspicious.
 */
function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

/** Count distinct user agents, ignoring absent ones (they are not "distinct"). */
function countDistinctAgents(clicks: readonly ClickSample[]): number {
  const seen = new Set<string>();
  for (const click of clicks) {
    const ua = normaliseUserAgent(click.userAgent);
    if (ua.length > 0) seen.add(ua);
  }
  return seen.size;
}

/** Clicks per hour for a window of the given length. */
function clicksPerHour(count: number, windowMs: number): number {
  if (windowMs <= 0) return 0;
  return (count / windowMs) * 3_600_000;
}

/**
 * Rule 1 — duplicate suppression.
 *
 * Groups by (ip_hash, minute bucket) and counts each group once; the signal is
 * the share of clicks that disappear. A null ip_hash cannot be deduplicated
 * against anything, so unhashed clicks are counted as distinct and cannot
 * inflate this signal on their own.
 */
export function scoreDeduplication(clicks: readonly ClickSample[]): RuleSignal {
  if (clicks.length < 2) {
    return { score: 0, reason: { vi: 'Chưa đủ dữ liệu.', en: 'Not enough clicks to assess.' } };
  }

  const distinctKeys = new Set<string>();
  for (const click of clicks) {
    if (typeof click.ipHash !== 'string' || click.ipHash.length === 0) {
      distinctKeys.add(`unhashed:${distinctKeys.size}:${click.createdAt}`);
      continue;
    }
    const bucket = Math.floor(click.createdAt / RISK_THRESHOLDS.dedupWindowMs);
    distinctKeys.add(`${click.ipHash}:${bucket}`);
  }

  const duplicates = clicks.length - distinctKeys.size;
  const reason: RuleReason = duplicates === 0
    ? { vi: 'Không có click trùng lặp trong cửa sổ 60 giây.', en: 'No duplicate clicks inside the 60-second window.' }
    : {
        vi: `${duplicates}/${clicks.length} click trùng lặp trong cửa sổ 60 giây.`,
        en: `${duplicates}/${clicks.length} clicks were duplicates inside the 60-second window.`,
      };

  return { score: clampUnit(duplicates / clicks.length), reason };
}

/**
 * Rule 2 — click velocity with a narrow client fingerprint.
 *
 * Fires only when the hourly rate exceeded the threshold AND the traffic came
 * from fewer than the minimum distinct user agents. Volume alone is legitimate;
 * volume plus a single client is not. Ramped 0 at the threshold to 1 at twice it,
 * so a marginal overage is weaker evidence than a 3x flood.
 */
export function scoreVelocity(clicks: readonly ClickSample[], windowMs: number): RuleSignal {
  if (windowMs <= 0 || clicks.length === 0) {
    return { score: 0, reason: { vi: 'Chưa có click trong kỳ.', en: 'No clicks in the period.' } };
  }

  const perHour = clicksPerHour(clicks.length, windowMs);
  const distinctAgents = countDistinctAgents(clicks);

  const overThreshold = perHour > RISK_THRESHOLDS.velocityPerHour;
  const tooFewAgents = distinctAgents < RISK_THRESHOLDS.minDistinctUserAgents;

  if (!overThreshold || !tooFewAgents) {
    return {
      score: 0,
      reason: {
        vi: `Tốc độ ${perHour.toFixed(1)} click/giờ với ${distinctAgents} trình duyệt là bình thường.`,
        en: `Rate of ${perHour.toFixed(1)} clicks/hour across ${distinctAgents} clients looks normal.`,
      },
    };
  }

  const score = clampUnit(perHour / (RISK_THRESHOLDS.velocityPerHour * 2) - 0.5);

  return {
    score,
    reason: {
      vi: `${perHour.toFixed(1)} click/giờ nhưng chỉ ${distinctAgents} trình duyệt — dấu hiệu tool tự động.`,
      en: `${perHour.toFixed(1)} clicks/hour from only ${distinctAgents} clients — automated traffic.`,
    },
  };
}

/**
 * Rule 3 — absent or non-human user agent.
 *
 * The signal is the share of clicks whose user agent is missing or matches a
 * known automation signature. Real browsers always send one, so a high share
 * means the traffic is largely scripted.
 */
export function scoreBotUserAgents(clicks: readonly ClickSample[]): RuleSignal {
  if (clicks.length === 0) {
    return { score: 0, reason: { vi: 'Chưa có click trong kỳ.', en: 'No clicks in the period.' } };
  }

  const botCount = clicks.filter((click) => isBotUserAgent(click.userAgent)).length;
  const reason: RuleReason = botCount === 0
    ? { vi: 'Mọi click đều có thông tin trình duyệt hợp lệ.', en: 'Every click carried a valid browser signature.' }
    : {
        vi: `${botCount}/${clicks.length} click không có hoặc có thông tin trình duyệt không hợp lệ.`,
        en: `${botCount}/${clicks.length} clicks had a missing or non-human browser signature.`,
      };

  return { score: clampUnit(botCount / clicks.length), reason };
}

/**
 * Combine the three rule signals into one verdict.
 *
 * The composite is the weighted mean of the signals, so a single weak rule
 * cannot push a partner over the threshold by itself — the weights require
 * corroboration. Duplicate suppression carries the highest weight because a
 * repeated IP/time pair is the hardest signal to produce by accident.
 */
export function computeRiskVerdict(clicks: readonly ClickSample[], windowMs: number): RiskVerdict {
  const dedup = scoreDeduplication(clicks);
  const velocity = scoreVelocity(clicks, windowMs);
  const botUserAgent = scoreBotUserAgents(clicks);

  const score = clampUnit(
    dedup.score * RISK_WEIGHTS.dedup
      + velocity.score * RISK_WEIGHTS.velocity
      + botUserAgent.score * RISK_WEIGHTS.botUserAgent,
  );

  return {
    score,
    isSuspicious: score >= RISK_THRESHOLDS.suspiciousScore,
    signals: { dedup, velocity, botUserAgent },
  };
}

/**
 * Status a partner should hold after a verdict.
 *
 * `under_review` is the only state a flag can set, and only when the partner is
 * not already suspended by a human. A score never suspends or deletes: a false
 * positive must not be able to silently stop a legitimate partner earning.
 */
export function resolvePartnerStatusAfterRisk(
  currentStatus: PartnerStatusLike,
  verdict: RiskVerdict,
): PartnerStatusLike {
  if (!verdict.isSuspicious) return currentStatus;
  if (currentStatus === 'suspended') return currentStatus;
  return 'under_review';
}
