/**
 * channel-caption-rules-data.ts — Default per-channel caption rules map
 *
 * @module seed/i18n/channel-caption-rules-data
 */

import type { ChannelProvider, ChannelCaptionRule } from './channel-caption-rules'

/**
 * Per-channel caption rules.
 * Order: Vietnam → SEA → Global West → Professional → Long-form
 */
export const CHANNEL_RULES_MAP: Record<ChannelProvider, ChannelCaptionRule> = {
  // Vietnam / SEA — translate to Vietnamese, casual + mixed hashtags
  zalo: {
    targetLocale: 'vi',
    charCap: 1000,
    hashtagStyle: 'mixed_vi_en',
  },
  telegram: {
    targetLocale: 'vi',
    charCap: 4096,
    hashtagStyle: 'mixed_vi_en',
  },
  facebook: {
    targetLocale: 'vi',
    charCap: 63206,
    hashtagStyle: 'mixed_vi_en',
  },
  tiktok: {
    targetLocale: 'vi',
    charCap: 2200,
    hashtagStyle: 'mixed_vi_en',
  },

  // Global English — short + formal
  twitter: {
    targetLocale: 'en',
    charCap: 280,
    hashtagStyle: 'formal_en',
  },
  threads: {
    targetLocale: 'en',
    charCap: 500,
    hashtagStyle: 'formal_en',
  },
  instagram: {
    targetLocale: 'en',
    charCap: 2200,
    hashtagStyle: 'formal_en',
  },
  youtube: {
    targetLocale: 'en',
    charCap: 5000,
    hashtagStyle: 'formal_en',
  },
  pinterest: {
    targetLocale: 'en',
    charCap: 500,
    hashtagStyle: 'formal_en',
  },
  reddit: {
    targetLocale: 'en',
    charCap: 40000,
    hashtagStyle: 'none',
  },
  bluesky: {
    targetLocale: 'en',
    charCap: 300,
    hashtagStyle: 'minimal',
  },
  mastodon: {
    targetLocale: 'en',
    charCap: 500,
    hashtagStyle: 'minimal',
  },

  // Professional
  linkedin: {
    targetLocale: 'en',
    charCap: 3000,
    hashtagStyle: 'formal_en',
  },
}
