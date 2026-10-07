/**
 * Anti-Detection & Creator Proxy Types
 *
 * Types for residential proxy rotation, browser fingerprint isolation,
 * and rate-limiting across multi-channel video uploads.
 *
 * Layer: tree/affiliate/proxy (Domain Types)
 * @module tree/affiliate/proxy/anti-detection-types
 */

export type SocialPlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels';

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export type ProxyStatus = 'HEALTHY' | 'DEGRADED' | 'BANNED';

export interface ProxyNode {
  id: string;
  host: string;
  port: number;
  protocol: ProxyProtocol;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. 'US', 'VN'
  status: ProxyStatus;
  consecutiveFailures: number;
  lastUsedMs: number;
  assignedChannelId?: string;
}

export interface BrowserFingerprint {
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  platform: string;
  canvasNoiseSeed: number;
  webglVendor: string;
  locale: string;
}

export interface CreatorChannelAccount {
  channelId: string;
  platform: SocialPlatform;
  username: string;
  dailyUploadCount: number;
  maxDailyUploads: number; // e.g. 4 videos/day
  minIntervalHours: number; // e.g. 3 hours spacing
  lastUploadTimestampMs: number;
  assignedProxyId?: string;
  fingerprint: BrowserFingerprint;
}

export interface DispatchEligibilityResult {
  allowed: boolean;
  reason: string;
  nextAvailableTimeMs?: number;
  assignedProxy?: ProxyNode;
  fingerprint?: BrowserFingerprint;
}
