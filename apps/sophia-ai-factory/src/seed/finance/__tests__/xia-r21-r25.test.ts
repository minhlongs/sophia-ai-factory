import { describe, expect, it } from 'vitest';
import {
  buildCookielessRedirectUrl,
  computeMultiTouchAttribution,
} from '@/seed/analytics/cookieless-attribution';
import { scoreFrame1VisualHook } from '@/seed/video/frame1-hook-scorer';
import {
  isHardLinkFailureStatus,
  resolveGeoFailoverOffer,
} from '@/seed/affiliate/geo-failover-router';
import { evaluateCreatorCadence } from '@/seed/growth/creator-cadence-engine';
import { allocateIntegerCentWaterfall } from '@/seed/finance/integer-cent-waterfall';

describe('Rounds 21–25 Clean-Room Moat Cores', () => {
  it('R21: builds cookieless redirect URLs and computes U-shaped 40/20/40 attribution', () => {
    const url = buildCookielessRedirectUrl('https://partner.example.com/offer?cid={click_id}', 'clk_99', 'yt_short');
    expect(url).toBe('https://partner.example.com/offer?cid=clk_99&sub_id=yt_short');

    const credits = computeMultiTouchAttribution(
      [
        { clickId: 'c1', channel: 'tiktok', timestampMs: 1000 },
        { clickId: 'c2', channel: 'telegram', timestampMs: 2000 },
        { clickId: 'c3', channel: 'youtube', timestampMs: 3000 },
      ],
      'position_40_20_40',
    );
    expect(credits.map((c) => c.weight)).toEqual([0.4, 0.2, 0.4]);
  });

  it('R22: scores Frame-1 visual hook safe-zone clearance and WCAG contrast', () => {
    const clean = scoreFrame1VisualHook({
      platform: 'tiktok',
      headline: 'Cut Crypto Fees 40%',
      textHex: '#FFFFFF',
      bgHex: '#090A10',
      textBox: { x: 100, y: 200, width: 700, height: 200 },
    });
    expect(clean.safeZoneClear).toBe(true);
    expect(clean.wcagAaPass).toBe(true);
    expect(clean.score100).toBe(100);
  });

  it('R23: routes around geo-blocked or circuit-open offers while ignoring WAF 403', () => {
    expect(isHardLinkFailureStatus(403)).toBe(false);
    expect(isHardLinkFailureStatus(404)).toBe(true);

    const decision = resolveGeoFailoverOffer(
      [
        { id: 'cex-global', url: 'https://cex.example/global', blockedCountries: ['US'], consecutiveHardFailures: 0, breakerState: 'closed' },
        { id: 'saas-us', url: 'https://saas.example/us', blockedCountries: [], consecutiveHardFailures: 0, breakerState: 'closed' },
      ],
      'US',
    );
    expect(decision.selectedOfferId).toBe('saas-us');
  });

  it('R24: enforces burst-deferring cadence caps and non-auto-resuming action-block breaker', () => {
    const deferred = evaluateCreatorCadence({
      postsToday: 3,
      dailyCap: 3,
      currentStreakDays: 5,
      graceTokensRemaining: 2,
      actionBlockTripped: false,
    });
    expect(deferred.status).toBe('defer_burst');

    const tripped = evaluateCreatorCadence({
      postsToday: 0,
      dailyCap: 3,
      currentStreakDays: 5,
      graceTokensRemaining: 2,
      actionBlockTripped: true,
    });
    expect(tripped.status).toBe('paused_circuit_breaker');
  });

  it('R25: allocates 70/20/10 integer-cent waterfall with zero floating-point drift', () => {
    const stmt = allocateIntegerCentWaterfall(99_999n, [
      { participantId: 'creator_1', role: 'creator', basisPoints: 7000 },
      { participantId: 'va_1', role: 'va_editor', basisPoints: 2000 },
      { participantId: 'agency_1', role: 'agency', basisPoints: 1000 },
    ]);
    expect(stmt.balanced).toBe(true);
    expect(stmt.allocations.map((a) => a.cents)).toEqual([69_999n, 20_000n, 10_000n]);
    expect(stmt.allocations.reduce((s, a) => s + a.cents, 0n)).toBe(99_999n);
  });
});
