/**
 * Edge CDN Signed Download Tokens, Forensic Watermark & Cloudflare Stream Types
 *
 * Layer: seed/types (Foundational pure types and constants)
 * Dependencies: None (0 upper-layer imports)
 *
 * @module seed/types/streaming-events
 */

/**
 * Payload encoded inside 24-hour HMAC signed download tokens
 */
export interface SignedDownloadTokenPayload {
  videoId: string;
  userId: string;
  tenantId: string;
  issuedAt: number; // Unix epoch timestamp (seconds)
  expiresAt: number; // Unix epoch timestamp (seconds)
}

export interface CreateSignedDownloadTokenParams {
  videoId: string;
  userId: string;
  tenantId: string;
  ttlSeconds?: number; // Defaults to 86400 (24 hours)
  secret: string;
}

export interface VerifySignedDownloadTokenParams {
  token: string;
  videoId: string;
  secret: string;
}

export interface VerifySignedDownloadTokenResult {
  valid: boolean;
  expired: boolean;
  payload?: SignedDownloadTokenPayload;
}

export interface DynamicForensicWatermarkConfig {
  tenantId: string;
  userId: string;
  customText?: string;
  opacity?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  date?: Date;
}

export interface DynamicForensicWatermarkResult {
  overlayText: string;
  opacity: number;
  position: string;
  forensicHash: string;
}

export interface CloudflareStreamPlaybackUrls {
  hls: string;
  dash: string;
  preview: string;
  thumbnail: string;
}

export interface CloudflareStreamVideoDetails {
  uid: string;
  creator?: string;
  thumbnail?: string;
  readyToStream: boolean;
  status?: {
    state: 'inprogress' | 'ready' | 'error' | 'downloading' | 'queued';
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta?: Record<string, string>;
  created?: string;
  modified?: string;
  duration?: number;
  maxDurationSeconds?: number;
  playback?: CloudflareStreamPlaybackUrls;
}

export interface CloudflareStreamUploadResult {
  success: boolean;
  uid?: string;
  details?: CloudflareStreamVideoDetails;
  error?: string;
}
