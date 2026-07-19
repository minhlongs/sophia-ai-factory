/**
 * bundle-definitions.test.ts — Tests for preset channel bundle definitions
 */

import { describe, it, expect } from 'vitest';
import {
  CHANNEL_BUNDLES,
  BUNDLE_IDS,
  getBundleChannels,
  type BundleId,
} from '../bundle-definitions';

describe('CHANNEL_BUNDLES', () => {
  it('defines all 4 bundles', () => {
    expect(BUNDLE_IDS).toHaveLength(4);
    expect(BUNDLE_IDS).toEqual(['vietnam', 'global', 'professional', 'maximum']);
  });

  it('vietnam bundle has Zalo, Facebook, Telegram', () => {
    expect(CHANNEL_BUNDLES.vietnam.channels).toContain('zalo');
    expect(CHANNEL_BUNDLES.vietnam.channels).toContain('facebook');
    expect(CHANNEL_BUNDLES.vietnam.channels).toContain('telegram');
    expect(CHANNEL_BUNDLES.vietnam.channels).toHaveLength(3);
  });

  it('global bundle has YouTube, TikTok, Instagram, Pinterest', () => {
    expect(CHANNEL_BUNDLES.global.channels).toContain('youtube');
    expect(CHANNEL_BUNDLES.global.channels).toContain('tiktok');
    expect(CHANNEL_BUNDLES.global.channels).toContain('instagram');
    expect(CHANNEL_BUNDLES.global.channels).toContain('pinterest');
    expect(CHANNEL_BUNDLES.global.channels).toHaveLength(4);
  });

  it('professional bundle has LinkedIn, Twitter, Threads', () => {
    expect(CHANNEL_BUNDLES.professional.channels).toContain('linkedin');
    expect(CHANNEL_BUNDLES.professional.channels).toContain('twitter');
    expect(CHANNEL_BUNDLES.professional.channels).toContain('threads');
    expect(CHANNEL_BUNDLES.professional.channels).toHaveLength(3);
  });

  it('maximum bundle contains all 13 channels', () => {
    expect(CHANNEL_BUNDLES.maximum.channels).toHaveLength(13);
    // Spot check
    expect(CHANNEL_BUNDLES.maximum.channels).toContain('telegram');
    expect(CHANNEL_BUNDLES.maximum.channels).toContain('mastodon');
    expect(CHANNEL_BUNDLES.maximum.channels).toContain('bluesky');
  });

  it('no duplicate channels within any bundle', () => {
    for (const bundleId of BUNDLE_IDS) {
      const channels = CHANNEL_BUNDLES[bundleId].channels;
      const unique = new Set(channels);
      expect(unique.size).toBe(channels.length);
    }
  });
});

describe('getBundleChannels', () => {
  it('returns only channels that are in the active providers set', () => {
    const active = new Set(['zalo', 'facebook']);
    const result = getBundleChannels('vietnam', active);
    expect(result).toEqual(['zalo', 'facebook']);
    expect(result).not.toContain('telegram');
  });

  it('returns empty array when none of the bundle channels are connected', () => {
    const active = new Set(['youtube', 'tiktok']);
    const result = getBundleChannels('vietnam', active);
    expect(result).toHaveLength(0);
  });

  it('returns all bundle channels when all are active', () => {
    const active = new Set(['zalo', 'facebook', 'telegram']);
    const result = getBundleChannels('vietnam', active);
    expect(result).toHaveLength(3);
  });

  it('preserves bundle channel order', () => {
    const active = new Set(['pinterest', 'youtube', 'tiktok', 'instagram']);
    const result = getBundleChannels('global', active);
    // Bundle order: youtube, tiktok, instagram, pinterest
    expect(result).toEqual(['youtube', 'tiktok', 'instagram', 'pinterest']);
  });

  it('handles maximum bundle with partial active channels', () => {
    const active = new Set(['youtube', 'tiktok', 'linkedin']);
    const result = getBundleChannels('maximum', active);
    expect(result).toContain('youtube');
    expect(result).toContain('tiktok');
    expect(result).toContain('linkedin');
    expect(result).not.toContain('zalo');
    expect(result).not.toContain('telegram');
  });
});
