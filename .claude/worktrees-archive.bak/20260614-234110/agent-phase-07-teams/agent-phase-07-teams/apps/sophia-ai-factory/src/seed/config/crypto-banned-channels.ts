/**
 * crypto-banned-channels.ts — Jurisdiction × channel ban matrix
 *
 * Maps jurisdiction codes to channel/platform identifiers that are
 * forbidden for crypto affiliate content.
 *
 * VN: All channels banned (full state prohibition).
 * Others: No channel-level bans beyond the disclaimer requirement,
 * but Zalo (VN-domestic platform) is blocked for crypto regardless
 * of declared jurisdiction because its primary audience is Vietnamese.
 *
 * @module seed/config/crypto-banned-channels
 */

import type { CryptoJurisdiction } from './crypto-disclaimer-registry';

/** Channel identifiers that match `SupportedProvider` values. */
export type ChannelId = string;

/**
 * Per-jurisdiction channel ban list.
 * Keys are jurisdiction codes; values are arrays of banned channel IDs.
 */
export const CRYPTO_BANNED_CHANNELS: Record<CryptoJurisdiction, ChannelId[]> = {
  /** VN: full ban on all crypto promotion — block every channel. */
  VN: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'zalo', 'linkedin', 'pinterest', 'threads', 'bluesky', 'reddit', 'mastodon'],

  /** US: no platform-level ban beyond disclaimer. */
  US: [],

  /** EU: no platform-level ban beyond disclaimer. */
  EU: [],

  /** SG: no platform-level ban beyond disclaimer. */
  SG: [],

  /** JP: no platform-level ban beyond disclaimer. */
  JP: [],
};

/**
 * Channels with primarily Vietnamese audience — blocked for crypto
 * regardless of declared jurisdiction, because the content will
 * reach an audience subject to VN law.
 */
export const VN_AUDIENCE_CHANNELS: ChannelId[] = ['zalo'];

/**
 * Return the list of banned channels for a given jurisdiction.
 * Always includes VN-audience channels regardless of jurisdiction.
 */
export function getBannedChannelsForJurisdiction(jurisdiction: string): ChannelId[] {
  const key = jurisdiction.toUpperCase() as CryptoJurisdiction;
  const jurisdictionBans = CRYPTO_BANNED_CHANNELS[key] ?? [];

  // De-duplicate: merge jurisdiction bans + VN-audience channels
  const combined = new Set([...jurisdictionBans, ...VN_AUDIENCE_CHANNELS]);
  return Array.from(combined);
}

/**
 * Return true if the given channel is banned for crypto content in this jurisdiction.
 */
export function isChannelBannedForCrypto(
  channelId: ChannelId,
  jurisdiction: string,
): boolean {
  return getBannedChannelsForJurisdiction(jurisdiction).includes(channelId.toLowerCase());
}
