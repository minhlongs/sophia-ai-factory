/**
 * channel-caption-rules.ts — Per-channel caption localization rules
 *
 * Defines:
 *   - Target locale per channel (channel → locale mapping)
 *   - Character cap per channel
 *   - Hashtag style per channel
 *
 * All values are configurable via environment or future DB settings.
 * Defaults are baked in for production correctness without configuration.
 *
 * @module lib/i18n/channel-caption-rules
 */

import type { ChannelProvider } from '@/seed/types/channel-provider'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const HashtagStyle = z.enum(['formal_en', 'mixed_vi_en', 'minimal', 'none'])
export type HashtagStyle = z.infer<typeof HashtagStyle>

export interface ChannelCaptionRule {
  /** BCP-47 target locale for translation. 'source' = keep original. */
  targetLocale: string
  /** Max caption length (chars). 0 = no cap. */
  charCap: number
  /** Hashtag style for this channel. */
  hashtagStyle: HashtagStyle
}

// ---------------------------------------------------------------------------
// Defaults map
// ---------------------------------------------------------------------------

/**
 * Per-channel caption rules.
 * Order: Vietnam → SEA → Global West → Professional → Long-form
 */
const CHANNEL_RULES_MAP: Record<ChannelProvider, ChannelCaptionRule> = {
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

  // East Asia
  // (weibo not in ChannelProvider yet — future extension point)

  // Japan
  // (line not in ChannelProvider yet — future extension point)

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get caption rules for a channel provider.
 * Always returns a value — falls back to English-neutral defaults.
 */
export function getChannelCaptionRule(provider: ChannelProvider): ChannelCaptionRule {
  return CHANNEL_RULES_MAP[provider] ?? {
    targetLocale: 'en',
    charCap: 0,
    hashtagStyle: 'formal_en',
  }
}

/**
 * Trim caption to channel's char cap.
 * If cap is 0, returns original. Appends '…' when truncated.
 */
export function enforceCharCap(caption: string, charCap: number): string {
  if (charCap === 0 || caption.length <= charCap) return caption
  // Reserve 1 char for ellipsis
  return caption.slice(0, charCap - 1) + '…'
}
