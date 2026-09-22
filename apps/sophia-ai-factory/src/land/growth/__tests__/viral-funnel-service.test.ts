import { describe, it, expect, vi } from 'vitest';
import { getViralFunnelOverview } from '../viral-funnel-service';

describe('Viral Funnel Service (Land Layer)', () => {
  it('returns a comprehensive funnel overview with non-zero metrics', async () => {
    const overview = await getViralFunnelOverview();

    expect(overview).toBeDefined();
    expect(overview.totalVideos).toBeGreaterThan(0);
    expect(overview.totalViews).toBeGreaterThan(0);
    expect(overview.totalCtaClicks).toBeGreaterThan(0);
    expect(overview.totalLeads).toBeGreaterThan(0);
    expect(overview.totalRevenueUsd).toBeGreaterThan(0);

    // CTR check
    const expectedCtr = Number(
      ((overview.totalCtaClicks / overview.totalViews) * 100).toFixed(1),
    );
    expect(overview.averageCtrPct).toBe(expectedCtr);

    // Top performers
    expect(['ai_automation', 'ecommerce', 'solopreneur']).toContain(overview.topPerformingNiche);
    expect([
      'curiosity_gap',
      'shock_stat',
      'direct_question',
      'problem_solution',
      'contrarian',
    ]).toContain(overview.topPerformingHook);
  });

  it('provides detailed per-video funnel items with valid CTR and status', async () => {
    const overview = await getViralFunnelOverview();
    expect(overview.items.length).toBeGreaterThan(0);

    overview.items.forEach((item) => {
      expect(item.videoId).toBeTruthy();
      expect(item.videoTitle).toBeTruthy();
      expect(['ai_automation', 'ecommerce', 'solopreneur']).toContain(item.niche);
      expect(['tiktok', 'youtube_shorts', 'twitter', 'x', 'all']).toContain(item.platform);
      expect(item.views).toBeGreaterThan(0);
      expect(item.ctaClicks).toBeGreaterThan(0);
      expect(item.ctrPct).toBeGreaterThan(0);
      expect(item.leadsCount).toBeGreaterThanOrEqual(0);
      expect(['active', 'viral', 'needs_optimization']).toContain(item.status);
    });
  });

  it('handles user-scoped queries smoothly', async () => {
    const userOverview = await getViralFunnelOverview('user_test_founder_1');
    expect(userOverview).toBeDefined();
    expect(userOverview.items.length).toBeGreaterThan(0);
  });
});
