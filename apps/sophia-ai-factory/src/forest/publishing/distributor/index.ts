/**
 * Viral Multi-Platform Video Publishing Orchestrator
 * Layer: Forest
 *
 * @module forest/publishing/distributor
 */

export type { TrackingUrlOptions, TelegramDeepLinkOptions } from './types';
export { buildFunnelTrackingUrl, buildTelegramDeepLink } from './tracking-urls';
export { formatPlatformCaption } from './caption-formatter';
export { publishSinglePlatform, publishToViralPlatforms } from './platform-publisher';
