/**
 * crypto-banned-channels.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getBannedChannelsForJurisdiction,
  isChannelBannedForCrypto,
} from '../crypto-banned-channels';

describe('getBannedChannelsForJurisdiction', () => {
  it('VN bans all major channels', () => {
    const banned = getBannedChannelsForJurisdiction('VN');
    expect(banned).toContain('youtube');
    expect(banned).toContain('tiktok');
    expect(banned).toContain('zalo');
    expect(banned.length).toBeGreaterThan(5);
  });

  it('US, EU, SG, JP only ban VN-audience channels (zalo)', () => {
    for (const j of ['US', 'EU', 'SG', 'JP']) {
      const banned = getBannedChannelsForJurisdiction(j);
      expect(banned).toContain('zalo');
      expect(banned).not.toContain('youtube');
      expect(banned).not.toContain('tiktok');
    }
  });

  it('is case-insensitive for jurisdiction', () => {
    const lower = getBannedChannelsForJurisdiction('vn');
    const upper = getBannedChannelsForJurisdiction('VN');
    expect(lower).toEqual(upper);
  });
});

describe('isChannelBannedForCrypto', () => {
  it('zalo is banned for all jurisdictions', () => {
    for (const j of ['US', 'EU', 'VN', 'SG', 'JP']) {
      expect(isChannelBannedForCrypto('zalo', j)).toBe(true);
    }
  });

  it('youtube is banned only for VN', () => {
    expect(isChannelBannedForCrypto('youtube', 'VN')).toBe(true);
    expect(isChannelBannedForCrypto('youtube', 'US')).toBe(false);
    expect(isChannelBannedForCrypto('youtube', 'EU')).toBe(false);
  });

  it('is case-insensitive for channel id', () => {
    expect(isChannelBannedForCrypto('ZALO', 'US')).toBe(true);
  });
});
