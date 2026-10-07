/**
 * Social Account Rotator.
 * Selects the optimal account in the pool balancing warming state, daily post limits, and proxy isolation.
 */

import type {
  AccountStatus,
  SocialAccountProfile,
  SocialPlatform,
} from './account-pool-types';

export function filterEligibleAccounts(
  accounts: SocialAccountProfile[],
  platform: SocialPlatform,
  niche: 'saas_global' | 'crypto_global'
): SocialAccountProfile[] {
  return accounts.filter((account) => {
    if (account.platform !== platform) return false;
    if (account.niche !== niche) return false;

    // Check status
    if (account.status !== 'active' && account.status !== 'warming_up') {
      return false;
    }

    // Check daily post limit
    const effectiveLimit =
      account.status === 'warming_up'
        ? Math.min(account.dailyPostLimit, Math.max(1, account.warmingPhaseDays))
        : account.dailyPostLimit;

    if (account.postsPublishedToday >= effectiveLimit) {
      return false;
    }

    return true;
  });
}

export function selectNextAccount(
  accounts: SocialAccountProfile[],
  platform: SocialPlatform,
  niche: 'saas_global' | 'crypto_global'
): SocialAccountProfile | null {
  const eligible = filterEligibleAccounts(accounts, platform, niche);
  if (eligible.length === 0) return null;

  // Sort by least posts published today, then oldest lastPublishedAt
  return eligible.sort((a, b) => {
    if (a.postsPublishedToday !== b.postsPublishedToday) {
      return a.postsPublishedToday - b.postsPublishedToday;
    }
    const timeA = a.lastPublishedAt ? new Date(a.lastPublishedAt).getTime() : 0;
    const timeB = b.lastPublishedAt ? new Date(b.lastPublishedAt).getTime() : 0;
    return timeA - timeB;
  })[0];
}

export function updateAccountStateAfterPublish(
  account: SocialAccountProfile,
  publishedAt = new Date().toISOString()
): SocialAccountProfile {
  const newCount = account.postsPublishedToday + 1;
  const isLimitReached = newCount >= account.dailyPostLimit;

  return {
    ...account,
    postsPublishedToday: newCount,
    lastPublishedAt: publishedAt,
    status: isLimitReached ? ('cooldown' as AccountStatus) : account.status,
  };
}
