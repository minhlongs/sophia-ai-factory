/**
 * Single source of truth for supported OAuth/channel providers.
 * @module seed/config/channels/supported-providers
 */

export const SUPPORTED_PROVIDERS = [
  'youtube',
  'tiktok',
  'instagram',
  'pinterest',
  'linkedin',
  'zalo',
  'facebook',
  'twitter',
] as const;

export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];
