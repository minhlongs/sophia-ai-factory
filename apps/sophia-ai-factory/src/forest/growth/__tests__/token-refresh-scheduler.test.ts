/**
 * Unit Tests for Social Token Refresh Scheduler
 * Layer: forest/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import { evaluateTokenRefreshUrgency, filterTokensRequiringRefresh } from '../token-refresh-scheduler';

describe('Token Refresh Scheduler Domain Engine', () => {
  const now = 1700000000000;
  const twoHours = 2 * 60 * 60 * 1000;

  it('flags token expiring within 2 hours as needing proactive refresh', () => {
    const expiresAt = now + twoHours - 10000; // 1 hour 59 mins away
    const status = evaluateTokenRefreshUrgency('acc_yt_1', 'YOUTUBE_SHORTS', expiresAt, now);

    expect(status.needsProactiveRefresh).toBe(true);
    expect(status.isStale).toBe(false);
  });

  it('marks expired tokens as stale and needing refresh', () => {
    const expiresAt = now - 5000;
    const status = evaluateTokenRefreshUrgency('acc_tt_1', 'TIKTOK_V2', expiresAt, now);

    expect(status.isStale).toBe(true);
    expect(status.needsProactiveRefresh).toBe(true);
  });

  it('does not flag token with ample validity (> 2 hours)', () => {
    const expiresAt = now + twoHours + 3600000; // 3 hours away
    const status = evaluateTokenRefreshUrgency('acc_ig_1', 'INSTAGRAM_REELS', expiresAt, now);

    expect(status.needsProactiveRefresh).toBe(false);
    expect(status.isStale).toBe(false);
  });

  it('filters multiple accounts correctly', () => {
    const accounts = [
      { accountId: 'acc_1', platform: 'YOUTUBE_SHORTS' as const, expiresAtMs: now + 300000 }, // 5 mins left -> refresh
      { accountId: 'acc_2', platform: 'TIKTOK_V2' as const, expiresAtMs: now + 50000000 }, // long -> ok
    ];
    const filtered = filterTokensRequiringRefresh(accounts, now);
    expect(filtered.length).toBe(1);
    expect(filtered[0].accountId).toBe('acc_1');
  });
});
