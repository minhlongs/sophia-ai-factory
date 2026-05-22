/**
 * Single source of truth for supported OAuth/channel providers.
 * @module seed/config/channels/supported-providers
 */

export const OAUTH_CHANNEL_PROVIDERS = [
  'youtube',
  'tiktok',
  'instagram',
  'pinterest',
  'linkedin',
  'zalo',
  'facebook',
  'twitter',
  'threads',
  'reddit',
  'bluesky',
  'mastodon',
] as const;

export const SUPPORTED_PROVIDERS = OAUTH_CHANNEL_PROVIDERS;

export const CHANNEL_STATUS_PROVIDERS = [
  ...OAUTH_CHANNEL_PROVIDERS,
  'telegram',
] as const;

export type SupportedProvider = typeof OAUTH_CHANNEL_PROVIDERS[number];
export type ChannelStatusProvider = typeof CHANNEL_STATUS_PROVIDERS[number];
