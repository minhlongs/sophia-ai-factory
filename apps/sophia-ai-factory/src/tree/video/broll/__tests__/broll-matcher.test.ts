import { describe, expect, it } from 'vitest';
import { CURATED_BROLL_ASSETS, getAssetsByNiche } from '../broll-asset-registry';
import { matchBRollTimeline } from '../broll-matcher';

describe('B-Roll Matcher & Asset Registry', () => {
  it('loads curated assets for saas_global and crypto_global niches', () => {
    const saasAssets = getAssetsByNiche('saas_global');
    const cryptoAssets = getAssetsByNiche('crypto_global');

    expect(saasAssets.length).toBeGreaterThanOrEqual(3);
    expect(cryptoAssets.length).toBeGreaterThanOrEqual(3);
    expect(CURATED_BROLL_ASSETS.length).toBeGreaterThanOrEqual(6);
  });

  it('generates high-retention video cues aligned with duration for SaaS', () => {
    const result = matchBRollTimeline({
      niche: 'saas_global',
      totalDurationSeconds: 15,
      scriptText: 'Check out this new SaaS tool that automates dashboard analytics and API deployments.',
      targetCutIntervalSeconds: 3.0,
    });

    expect(result.niche).toBe('saas_global');
    expect(result.totalCues).toBe(5);
    expect(result.coveragePercentage).toBe(100);
    expect(result.cues[0].startTimeSeconds).toBe(0);
    expect(result.cues[result.cues.length - 1].endTimeSeconds).toBe(15);
  });

  it('correctly maps crypto keywords to crypto categories and motion styles', () => {
    const result = matchBRollTimeline({
      niche: 'crypto_global',
      totalDurationSeconds: 10,
      scriptText: 'Massive breakout on the candlestick chart with new staking tokenomics rewards.',
      targetCutIntervalSeconds: 2.5,
    });

    expect(result.niche).toBe('crypto_global');
    expect(result.totalCues).toBe(4);
    const categories = result.cues.map((c) => c.category);
    expect(categories).toContain('crypto_candlestick');
    expect(result.cues[0].motionStyle).toBeDefined();
  });
});
