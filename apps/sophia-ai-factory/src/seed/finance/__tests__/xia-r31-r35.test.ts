import { describe, expect, it } from 'vitest';
import { matchBestVerticalBroll } from '@/seed/video/broll-scene-matcher';
import { lintAffiliateLandingHtml } from '@/seed/aeo/landing-preflight-linter';
import { evaluateAccountWarmupHealth } from '@/seed/growth/account-warmup-fsm';
import { routeByokLlmWithBudgetGuard } from '@/seed/ai/byok-fallback-router';
import { forecastAffiliateCohortLtv } from '@/seed/finance/cohort-ltv-forecaster';

describe('Rounds 31–35 Clean-Room Moat Cores', () => {
  it('R31: selects highest-scoring vertical commercial B-roll clip at $0 LLM COGS', () => {
    const match = matchBestVerticalBroll('Crypto traders compare exchange fees', 6, [
      { id: 'land-1', provider: 'pexels', width: 1920, height: 1080, durationSec: 10, commercialAllowed: true, keywords: ['crypto'] },
      { id: 'vert-1', provider: 'pexels', width: 1080, height: 1920, durationSec: 8, commercialAllowed: true, keywords: ['crypto', 'traders'] },
    ]);
    expect(match.selectedId).toBe('vert-1');
    expect(match.score100).toBe(100);
  });

  it('R32: audits affiliate landing HTML for viewport, disclosure, JSON-LD, and blocking scripts', () => {
    const clean = lintAffiliateLandingHtml(
      '<html><head><meta name="viewport" content="width=device-width"><script type="application/ld+json">{}</script></head><body>Affiliate disclosure: we earn a commission at no extra cost.</body></html>',
    );
    expect(clean.grade).toBe('A');
    expect(clean.hasAffiliateDisclosure).toBe(true);
    expect(clean.hasJsonLd).toBe(true);
  });

  it('R33: enforces Day 1-14 warm-up caps and trips cooldown on severe reach drop', () => {
    const healthy = evaluateAccountWarmupHealth({
      accountAgeDays: 2,
      baselineMedianViews: 1000,
      recentVideoViews: [950, 1100],
      cooldownUntilMs: null,
    });
    expect(healthy.state).toBe('healthy');
    expect(healthy.maxDailyPostsAllowed).toBe(1);

    const jailed = evaluateAccountWarmupHealth({
      accountAgeDays: 20,
      baselineMedianViews: 1000,
      recentVideoViews: [50, 40, 30],
      cooldownUntilMs: null,
    });
    expect(jailed.state).toBe('cooldown_open');
  });

  it('R34: falls back across BYOK providers and blocks calls exceeding daily spend cap', () => {
    const routed = routeByokLlmWithBudgetGuard({
      promptText: 'Write a 30s crypto fee comparison script.',
      expectedOutputTokens: 500,
      dailySpentCents: 10,
      dailyCapCents: 500,
      providers: [
        { provider: 'openrouter', hasKey: true, circuitOpen: true, authInvalid: false, costPerMillionTokensCents: 50 },
        { provider: 'openai', hasKey: true, circuitOpen: false, authInvalid: false, costPerMillionTokensCents: 60 },
      ],
    });
    expect(routed.allowed).toBe(true);
    expect(routed.selectedProvider).toBe('openai');
  });

  it('R35: forecasts integer-cent cohort LTV and CAC payback month deterministically', () => {
    const forecast = forecastAffiliateCohortLtv({
      monthlyCommissionCents: 3000n, // $30/mo
      cacCents: 5000n, // $50 CAC
      monthlyRetentionBps: 9000, // 90% monthly retention
      horizonMonths: 12,
    });
    expect(forecast.paybackMonth).toBe(2);
    expect(forecast.cumulativeLtvCents).toBeGreaterThan(20_000n);
    expect(forecast.ltvToCacRatio).toBeGreaterThan(4);
  });
});
