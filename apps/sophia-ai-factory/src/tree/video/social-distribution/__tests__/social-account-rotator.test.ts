import { describe, expect, it } from 'vitest';
import type { PublishPayload, SocialAccountProfile } from '../account-pool-types';
import {
  filterEligibleAccounts,
  selectNextAccount,
} from '../social-account-rotator';
import { dispatchVideoToPool } from '../social-publish-dispatcher';

describe('Social Account Rotator & Proxy Dispatcher', () => {
  const sampleAccounts: SocialAccountProfile[] = [
    {
      id: 'tt-crypto-01',
      platform: 'tiktok',
      handle: '@cryptohacks_daily',
      niche: 'crypto_global',
      status: 'active',
      dailyPostLimit: 3,
      postsPublishedToday: 2,
      proxyUrl: 'http://us-res-proxy-01.io:8080',
      warmingPhaseDays: 14,
    },
    {
      id: 'tt-crypto-02',
      platform: 'tiktok',
      handle: '@solana_gems_alpha',
      niche: 'crypto_global',
      status: 'active',
      dailyPostLimit: 4,
      postsPublishedToday: 0,
      proxyUrl: 'http://us-res-proxy-02.io:8080',
      warmingPhaseDays: 14,
    },
    {
      id: 'tt-crypto-03',
      platform: 'tiktok',
      handle: '@cooldown_channel',
      niche: 'crypto_global',
      status: 'cooldown',
      dailyPostLimit: 3,
      postsPublishedToday: 3,
      warmingPhaseDays: 14,
    },
  ];

  it('filters out exhausted and cooling down accounts', () => {
    const eligible = filterEligibleAccounts(sampleAccounts, 'tiktok', 'crypto_global');
    expect(eligible.length).toBe(2);
    expect(eligible.map((a) => a.id)).not.toContain('tt-crypto-03');
  });

  it('selects the account with the lowest posts published today for load balancing', () => {
    const nextAccount = selectNextAccount(sampleAccounts, 'tiktok', 'crypto_global');
    expect(nextAccount?.id).toBe('tt-crypto-02');
  });

  it('dispatches video payload and updates post counts and proxy information', () => {
    const payload: PublishPayload = {
      videoUrl: 'https://r2.agencyos.network/videos/sample.mp4',
      title: 'Solana 100x Secret',
      description: 'Check bio link for details',
      tags: ['#crypto', '#solana'],
      pinnedComment: 'Link in bio',
      affiliateTrackedUrl: 'https://aff.link/sol',
      targetPlatform: 'tiktok',
      niche: 'crypto_global',
    };

    const { result, updatedAccounts } = dispatchVideoToPool(payload, {
      accounts: sampleAccounts,
    });

    expect(result.success).toBe(true);
    expect(result.selectedAccountId).toBe('tt-crypto-02');
    expect(result.proxyUsed).toBe('http://us-res-proxy-02.io:8080');

    const updated = updatedAccounts.find((a) => a.id === 'tt-crypto-02');
    expect(updated?.postsPublishedToday).toBe(1);
    expect(result.rateLimitRemaining).toBe(3);
  });
});
