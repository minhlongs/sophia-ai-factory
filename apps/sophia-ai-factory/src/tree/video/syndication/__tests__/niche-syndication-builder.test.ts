/**
 * Unit Tests for Niche Syndication Builder
 *
 * Validates cross-platform payload assembly across YouTube Shorts, TikTok, and Instagram Reels.
 * @module tree/video/syndication/__tests__/niche-syndication-builder.test
 */

import { describe, it, expect } from 'vitest';
import { buildNicheSyndicationPackage } from '../niche-syndication-builder';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

describe('Niche Syndication Builder', () => {
  it('builds full syndication package for SaaS Global campaign', () => {
    const planRes = createNicheVideoCampaignPlan({
      niche: 'saas_global',
      blueprintId: 'saas_problem_agitation_solution',
      productName: 'Claude Enterprise',
      productUrl: 'https://anthropic.com',
      affiliateCode: 'partner_claude',
      locale: 'en',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const pkg = buildNicheSyndicationPackage(planRes.value, 'en');

    expect(pkg.productName).toBe('Claude Enterprise');
    expect(pkg.niche).toBe('saas_global');

    // 1. YouTube Shorts
    const yt = pkg.platforms.youtube_shorts;
    expect(yt.platform).toBe('youtube_shorts');
    expect(yt.title).toContain('Claude Enterprise Review');
    expect(yt.description).toContain(planRes.value.trackedUrl);
    expect(yt.hashtags).toContain('#saas');
    expect(yt.optimalPostingTimesUtc).toEqual(['14:00', '18:00', '22:00']);

    // 2. TikTok
    const tt = pkg.platforms.tiktok;
    expect(tt.platform).toBe('tiktok');
    expect(tt.caption).toContain('Claude Enterprise');
    expect(tt.hashtags).toContain('#fyp');
    expect(tt.soundRecommendation).toBeDefined();

    // 3. Instagram Reels
    const ig = pkg.platforms.instagram_reels;
    expect(ig.platform).toBe('instagram_reels');
    expect(ig.caption).toContain('Save this for later!');
    expect(ig.hashtags).toContain('#reels');
  });

  it('builds full syndication package for Crypto Global campaign with risk controls', () => {
    const planRes = createNicheVideoCampaignPlan({
      niche: 'crypto_global',
      blueprintId: 'crypto_fee_discount_signup_bonus',
      productName: 'Binance VIP',
      productUrl: 'https://binance.com',
      affiliateCode: 'vip_agent',
      jurisdiction: 'EU',
      locale: 'vi',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const pkg = buildNicheSyndicationPackage(planRes.value, 'vi');

    expect(pkg.niche).toBe('crypto_global');
    expect(pkg.platforms.youtube_shorts.pinnedComment.text).toContain('Lưu ý: Giao dịch Crypto có rủi ro');
    expect(pkg.platforms.tiktok.hashtags).toContain('#cryptotok');
  });
});
