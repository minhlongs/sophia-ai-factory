/**
 * Unit tests for the pure affiliate risk scorer.
 *
 * Each of the three rules is tested in isolation — a clean window, the boundary
 * just below the trigger, and a window that clearly fires — followed by the
 * composite threshold and the status resolution that must never auto-suspend.
 *
 * @module tree/affiliates/__tests__/risk-scorer
 */

import { describe, it, expect } from 'vitest';
import { isBotUserAgent } from '../user-agent-bot-detect';
import {
  RISK_THRESHOLDS,
  RISK_WEIGHTS,
  computeRiskVerdict,
  resolvePartnerStatusAfterRisk,
  scoreBotUserAgents,
  scoreDeduplication,
  scoreVelocity,
  type ClickSample,
} from '../risk-scorer';

/** A browser-like user agent used for the "clean traffic" cases. */
const HUMAN_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

/** Build a click, defaulting to a distinct human UA per call. */
function click(overrides: Partial<ClickSample> = {}): ClickSample {
  return {
    ipHash: 'a'.repeat(64),
    userAgent: HUMAN_UA,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('isBotUserAgent', () => {
  it('treats null, empty and whitespace-only as bot traffic', () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent('   ')).toBe(true);
  });

  it('accepts an ordinary browser string', () => {
    expect(isBotUserAgent(HUMAN_UA)).toBe(false);
  });

  it('flags known automation signatures', () => {
    for (const ua of [
      'curl/8.4.0',
      'python-requests/2.31.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1)',
      'Wget/1.21',
      'HeadlessChrome/119.0',
    ]) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });
});

describe('scoreDeduplication', () => {
  it('scores zero when there is nothing to compare', () => {
    expect(scoreDeduplication([]).score).toBe(0);
    expect(scoreDeduplication([click()]).score).toBe(0);
  });

  it('scores zero when every click is unique', () => {
    const clicks = [
      click({ ipHash: 'ip1', createdAt: 1_000 }),
      click({ ipHash: 'ip2', createdAt: 1_001 }),
      click({ ipHash: 'ip3', createdAt: 1_002 }),
    ];
    expect(scoreDeduplication(clicks).score).toBe(0);
  });

  it('scores zero when the same ip repeats outside the 60s window', () => {
    // Two clicks, same ip, but 61s apart — different minute buckets, not a duplicate.
    const clicks = [
      click({ ipHash: 'ip1', createdAt: 0 }),
      click({ ipHash: 'ip1', createdAt: RISK_THRESHOLDS.dedupWindowMs + 1 }),
    ];
    expect(scoreDeduplication(clicks).score).toBe(0);
  });

  it('measures the share of clicks that collapse away', () => {
    // Two clicks, identical ip inside the same 60s bucket: one is bogus.
    const clicks = [
      click({ ipHash: 'ip1', createdAt: 1_000_000 }),
      click({ ipHash: 'ip1', createdAt: 1_000_010 }),
    ];
    const result = scoreDeduplication(clicks);
    expect(result.score).toBe(0.5);
    expect(result.reason.en).toContain('1/2');
  });

  it('approaches one as the duplicate share dominates', () => {
    const base = 1_000_000;
    // 101 clicks, identical ip inside one bucket: 100 bogus of 101.
    const clicks = Array.from({ length: 101 }, (_, i) => click({ ipHash: 'ip1', createdAt: base + i * 5 }));
    const result = scoreDeduplication(clicks);
    // 100/101 rounds to 0.99 at the 2-decimal clamp.
    expect(result.score).toBe(0.99);
    expect(result.reason.en).toContain('100/101');
  });

  it('scores proportionally when only some clicks collapse', () => {
    // 4 clicks: two share an ip inside the window, two are distinct.
    const clicks = [
      click({ ipHash: 'ip1', createdAt: 500 }),
      click({ ipHash: 'ip1', createdAt: 550 }),
      click({ ipHash: 'ip2', createdAt: 600 }),
      click({ ipHash: 'ip3', createdAt: 700 }),
    ];
    // 1 of 4 clicks is a duplicate.
    expect(scoreDeduplication(clicks).score).toBe(0.25);
  });

  it('cannot be inflated by unhashed clicks alone', () => {
    const clicks = [
      click({ ipHash: null, createdAt: 100 }),
      click({ ipHash: null, createdAt: 200 }),
      click({ ipHash: null, createdAt: 300 }),
    ];
    expect(scoreDeduplication(clicks).score).toBe(0);
  });
});

describe('scoreVelocity', () => {
  const hour = 3_600_000;

  it('scores zero for an empty or non-positive window', () => {
    expect(scoreVelocity([], hour).score).toBe(0);
    expect(scoreVelocity([click()], 0).score).toBe(0);
  });

  it('scores zero at exactly the threshold', () => {
    // Exactly 20 clicks in an hour — the rule fires strictly above the threshold.
    const clicks = Array.from({ length: RISK_THRESHOLDS.velocityPerHour }, (_, i) =>
      click({ ipHash: `ip${i}`, userAgent: HUMAN_UA }),
    );
    const result = scoreVelocity(clicks, hour);
    expect(result.score).toBe(0);
  });

  it('starts scoring one click above the threshold', () => {
    const clicks = Array.from({ length: RISK_THRESHOLDS.velocityPerHour + 1 }, () =>
      click({ userAgent: HUMAN_UA }),
    );
    expect(scoreVelocity(clicks, hour).score).toBeGreaterThan(0);
  });

  it('scores zero when volume is high but agents are diverse', () => {
    const clicks = Array.from({ length: 30 }, (_, i) =>
      click({ ipHash: `ip${i}`, userAgent: `agent-${i}` }),
    );
    expect(scoreVelocity(clicks, hour).score).toBe(0);
  });

  it('scores zero when agents are few but volume is low', () => {
    const clicks = Array.from({ length: 5 }, () => click({ userAgent: HUMAN_UA }));
    expect(scoreVelocity(clicks, hour).score).toBe(0);
  });

  it('fires when volume is high and agents are few', () => {
    const clicks = Array.from({ length: 30 }, () => click({ userAgent: HUMAN_UA }));
    const result = scoreVelocity(clicks, hour);
    // 30/hour vs threshold 20 → (30/40) - 0.5 = 0.25
    expect(result.score).toBe(0.25);
    expect(result.reason.en).toContain('automated');
  });

  it('saturates at one for a large flood', () => {
    const clicks = Array.from({ length: 200 }, () => click({ userAgent: HUMAN_UA }));
    expect(scoreVelocity(clicks, hour).score).toBe(1);
  });

  it('scales the window correctly for a short observation period', () => {
    // 21 clicks in 10 minutes is 126/hour — well over threshold.
    const tenMinutes = 600_000;
    const clicks = Array.from({ length: 21 }, () => click({ userAgent: HUMAN_UA }));
    expect(scoreVelocity(clicks, tenMinutes).score).toBeGreaterThan(0);
  });
});

describe('scoreBotUserAgents', () => {
  it('scores zero for an empty window', () => {
    expect(scoreBotUserAgents([]).score).toBe(0);
  });

  it('scores zero when every click has a browser UA', () => {
    const clicks = [click(), click({ ipHash: 'ip2' })];
    expect(scoreBotUserAgents(clicks).score).toBe(0);
  });

  it('scores one when every UA is bot-like', () => {
    const clicks = [click({ userAgent: 'curl/8.4.0' }), click({ userAgent: null })];
    const result = scoreBotUserAgents(clicks);
    expect(result.score).toBe(1);
    expect(result.reason.en).toContain('non-human');
  });

  it('scores proportionally when only some are bots', () => {
    const clicks = [click(), click({ ipHash: 'ip2', userAgent: 'python-requests/2.31.0' })];
    expect(scoreBotUserAgents(clicks).score).toBe(0.5);
  });
});

describe('computeRiskVerdict', () => {
  const hour = 3_600_000;

  it('stays at zero for clean, diverse, human traffic', () => {
    const clicks = Array.from({ length: 10 }, (_, i) =>
      click({ ipHash: `ip${i}`, userAgent: `browser-${i}`, createdAt: 1_000 * i }),
    );
    const verdict = computeRiskVerdict(clicks, hour);
    expect(verdict.score).toBe(0);
    expect(verdict.isSuspicious).toBe(false);
  });

  it('flags a flood of bot clicks from one client', () => {
    // 60 clicks/hour, one UA, one ip inside a single minute.
    const base = 5_000_000;
    const clicks = Array.from({ length: 60 }, (_, i) =>
      click({ ipHash: 'ip1', userAgent: 'curl/8.4.0', createdAt: base + i * 900 }),
    );
    const verdict = computeRiskVerdict(clicks, hour);
    expect(verdict.score).toBeGreaterThanOrEqual(RISK_THRESHOLDS.suspiciousScore);
    expect(verdict.isSuspicious).toBe(true);
  });

  it('keeps the composite inside 0..1 with every rule saturated', () => {
    const base = 7_000_000;
    const clicks = Array.from({ length: 500 }, (_, i) =>
      click({ ipHash: 'ip1', userAgent: '', createdAt: base + i * 5 }),
    );
    const verdict = computeRiskVerdict(clicks, hour);
    expect(verdict.score).toBeLessThanOrEqual(1);
    expect(verdict.score).toBeGreaterThanOrEqual(0);
    expect(verdict.isSuspicious).toBe(true);
  });

  it('requires corroboration — one weak rule alone does not flag', () => {
    // Only the velocity rule fires (0.4 weight max, one bot-ish UA is harmless).
    const clicks = Array.from({ length: 25 }, () => click({ userAgent: HUMAN_UA }));
    const verdict = computeRiskVerdict(clicks, hour);
    expect(verdict.signals.velocity.score).toBeGreaterThan(0);
    expect(verdict.isSuspicious).toBe(false);
  });

  it('weights sum to exactly one so the composite cannot leave the unit range', () => {
    const total = RISK_WEIGHTS.dedup + RISK_WEIGHTS.velocity + RISK_WEIGHTS.botUserAgent;
    expect(total).toBe(1);
  });

  it('exposes a per-rule bilingual reason for every signal', () => {
    const verdict = computeRiskVerdict([click()], hour);
    for (const signal of Object.values(verdict.signals)) {
      expect(typeof signal.reason.vi).toBe('string');
      expect(typeof signal.reason.en).toBe('string');
      expect(signal.reason.vi.length).toBeGreaterThan(0);
    }
  });
});

describe('resolvePartnerStatusAfterRisk', () => {
  const flagged = computeRiskVerdict(
    Array.from({ length: 60 }, (_, i) => click({ ipHash: 'ip1', createdAt: 9_000_000 + i * 800 })),
    3_600_000,
  );
  const clean = computeRiskVerdict([click()], 3_600_000);

  it('moves an active partner to under_review when flagged', () => {
    expect(flagged.isSuspicious).toBe(true);
    expect(resolvePartnerStatusAfterRisk('active', flagged)).toBe('under_review');
  });

  it('leaves a clean active partner active', () => {
    expect(clean.isSuspicious).toBe(false);
    expect(resolvePartnerStatusAfterRisk('active', clean)).toBe('active');
  });

  it('never lifts a human suspension, in either direction', () => {
    // A flagged suspended partner stays suspended — the job must not restore
    // access that a human revoked.
    expect(resolvePartnerStatusAfterRisk('suspended', flagged)).toBe('suspended');
    // A clean suspended partner also stays suspended.
    expect(resolvePartnerStatusAfterRisk('suspended', clean)).toBe('suspended');
  });

  it('keeps an already under_review partner under_review', () => {
    expect(resolvePartnerStatusAfterRisk('under_review', flagged)).toBe('under_review');
  });
});
