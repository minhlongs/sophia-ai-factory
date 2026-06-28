/**
 * bundle-definitions.ts — Preset channel bundle configurations
 *
 * Defines the four built-in "publish-to-all" bundles:
 *   - vietnam: Zalo + Facebook + Telegram
 *   - global: YouTube + TikTok + Instagram + Pinterest
 *   - professional: LinkedIn + X/Twitter + Threads
 *   - maximum: All 13 channels (auto-filtered at publish time)
 *
 * Bundles are seed-level data — no DB required for definitions.
 * The founder can override via DB settings table later (extensible pattern).
 *
 * @module lib/publishing/bundle-definitions
 */

import type { ChannelProvider } from './publisher-interface';

export type BundleId = 'vietnam' | 'global' | 'professional' | 'maximum';

export interface ChannelBundle {
  id: BundleId;
  /** i18n key suffix — full key: dashboard.videos.distribute.bundles.<id>.* */
  labelKey: string;
  channels: ChannelProvider[];
}

export const CHANNEL_BUNDLES: Record<BundleId, ChannelBundle> = {
  vietnam: {
    id: 'vietnam',
    labelKey: 'vietnam',
    channels: ['zalo', 'facebook', 'telegram'],
  },
  global: {
    id: 'global',
    labelKey: 'global',
    channels: ['youtube', 'tiktok', 'instagram', 'pinterest'],
  },
  professional: {
    id: 'professional',
    labelKey: 'professional',
    channels: ['linkedin', 'twitter', 'threads'],
  },
  maximum: {
    id: 'maximum',
    labelKey: 'maximum',
    channels: [
      'youtube', 'tiktok', 'instagram', 'pinterest',
      'linkedin', 'facebook', 'twitter', 'threads',
      'reddit', 'bluesky', 'mastodon', 'zalo', 'telegram',
    ],
  },
};

export const BUNDLE_IDS: BundleId[] = ['vietnam', 'global', 'professional', 'maximum'];

/**
 * Return channels in a bundle that are present (connected) in the user's active channels.
 * Preserves bundle order.
 */
export function getBundleChannels(
  bundleId: BundleId,
  activeProviders: Set<string>,
): ChannelProvider[] {
  return CHANNEL_BUNDLES[bundleId].channels.filter((c) => activeProviders.has(c));
}
