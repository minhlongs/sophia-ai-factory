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

import { z } from 'zod'
import { CHANNEL_RULES_MAP } from './channel-caption-rules-data'

export type ChannelProvider =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'pinterest'
  | 'linkedin'
  | 'zalo'
  | 'facebook'
  | 'twitter'
  | 'threads'
  | 'reddit'
  | 'bluesky'
  | 'mastodon'
  | 'telegram'

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
