import { describe, it, expect } from 'vitest';
import {
  generateConsistentFingerprint,
  evaluateChannelUploadEligibility,
  recordUploadExecution,
} from '../anti-detection-rotator';
import type { CreatorChannelAccount, ProxyNode } from '../anti-detection-types';

describe('Multi-Account Anti-Detection & Creator Proxy Rotator', () => {
  const now = 1700000000000;

  const mockProxy: ProxyNode = {
    id: 'prx_1',
    host: '192.168.1.10',
    port: 8080,
    protocol: 'socks5',
    countryCode: 'US',
    status: 'HEALTHY',
    consecutiveFailures: 0,
    lastUsedMs: now - 3600000,
  };

  const mockAccount: CreatorChannelAccount = {
    channelId: 'chan_tiktok_01',
    platform: 'tiktok',
    username: '@sophia_growth',
    dailyUploadCount: 1,
    maxDailyUploads: 4,
    minIntervalHours: 3,
    lastUploadTimestampMs: now - 4 * 3600 * 1000, // 4 hours ago (>= 3 hours)
    assignedProxyId: 'prx_1',
    fingerprint: generateConsistentFingerprint('chan_tiktok_01', 'US'),
  };

  it('generates consistent deterministic fingerprint per channel seed', () => {
    const fp1 = generateConsistentFingerprint('seed_alpha');
    const fp2 = generateConsistentFingerprint('seed_alpha');
    expect(fp1).toEqual(fp2);
    expect(fp1.platform).toBe('iPhone');
    expect(fp1.userAgent).toContain('SophiaCreator');
  });

  it('allows upload when within daily quota and spacing interval', () => {
    const result = evaluateChannelUploadEligibility(mockAccount, now, [mockProxy]);
    expect(result.allowed).toBe(true);
    expect(result.assignedProxy?.id).toBe('prx_1');
    expect(result.fingerprint).toBeDefined();
  });

  it('rejects upload when spacing interval is not met (< 3 hours)', () => {
    const recentAccount: CreatorChannelAccount = {
      ...mockAccount,
      lastUploadTimestampMs: now - 1 * 3600 * 1000, // only 1 hour ago
    };

    const result = evaluateChannelUploadEligibility(recentAccount, now, [mockProxy]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Khoảng cách giữa các bài đăng chưa đủ 3 giờ');
  });

  it('rejects upload when daily limit is reached (>= 4 uploads)', () => {
    const cappedAccount: CreatorChannelAccount = {
      ...mockAccount,
      dailyUploadCount: 4,
    };

    const result = evaluateChannelUploadEligibility(cappedAccount, now, [mockProxy]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Đã chạm ngưỡng upload tối đa trong ngày (4/4)');
  });

  it('degrades and bans proxy on consecutive upload failures', () => {
    let currentProxy: ProxyNode = { ...mockProxy };
    let currentAccount = { ...mockAccount };

    // 3 failures -> DEGRADED
    for (let i = 0; i < 3; i++) {
      const { updatedProxy } = recordUploadExecution(currentAccount, false, now, currentProxy);
      currentProxy = updatedProxy!;
    }
    expect(currentProxy.status).toBe('DEGRADED');
    expect(currentProxy.consecutiveFailures).toBe(3);

    // 2 more failures (total 5) -> BANNED
    for (let i = 0; i < 2; i++) {
      const { updatedProxy } = recordUploadExecution(currentAccount, false, now, currentProxy);
      currentProxy = updatedProxy!;
    }
    expect(currentProxy.status).toBe('BANNED');
    expect(currentProxy.consecutiveFailures).toBe(5);
  });
});
