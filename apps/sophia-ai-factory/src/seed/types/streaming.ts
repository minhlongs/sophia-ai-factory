/**
 * Global Edge CDN & Adaptive HLS Streaming Types
 *
 * Layer: seed/types (Foundational pure types and constants)
 * Dependencies: None (0 upper-layer imports)
 *
 * @module seed/types/streaming
 */

export type QualityLadder = '1080p' | '720p' | '480p';

export interface QualityLadderConfig {
  quality: QualityLadder;
  width: number;
  height: number;
  bandwidth: number; // in bits per second (bps)
  averageBandwidth: number;
  frameRate: number;
  codecs: string;
}

/**
 * Standard Multi-Bitrate Ladder Presets per RFC 8216 & Cloudflare Edge CDN:
 * - 1080p: 5000 kbps (Full HD high-motion)
 * - 720p:  2800 kbps (HD standard)
 * - 480p:  1400 kbps (SD mobile data saver)
 */
export const QUALITY_LADDER_PRESETS: Record<QualityLadder, QualityLadderConfig> = {
  '1080p': {
    quality: '1080p',
    width: 1920,
    height: 1080,
    bandwidth: 5000000, // 5000 kbps
    averageBandwidth: 4500000,
    frameRate: 30.0,
    codecs: 'avc1.640028,mp4a.40.2',
  },
  '720p': {
    quality: '720p',
    width: 1280,
    height: 720,
    bandwidth: 2800000, // 2800 kbps
    averageBandwidth: 2500000,
    frameRate: 30.0,
    codecs: 'avc1.4d401f,mp4a.40.2',
  },
  '480p': {
    quality: '480p',
    width: 854,
    height: 480,
    bandwidth: 1400000, // 1400 kbps
    averageBandwidth: 1200000,
    frameRate: 30.0,
    codecs: 'avc1.4d401e,mp4a.40.2',
  },
};

export interface HlsVariantStream {
  quality: QualityLadder;
  bandwidth: number;
  averageBandwidth?: number;
  width: number;
  height: number;
  frameRate?: number;
  codecs?: string;
  url: string;
  uri?: string;
}

export interface HlsAudioTrack {
  id: string;
  language: string;
  name: string;
  isDefault?: boolean;
  autoSelect?: boolean;
  uri: string;
}

export interface HlsSubtitleTrack {
  id: string;
  language: string;
  name: string;
  isDefault?: boolean;
  autoSelect?: boolean;
  uri: string;
  format?: 'vtt' | 'srt';
}

/**
 * Contract per PROJECT.md § M4 (Edge CDN & HLS) ↔ Storage & Client Player
 */
export interface HlsMasterManifest {
  masterPlaylistUrl: string;
  variants: Array<{
    quality: QualityLadder;
    bandwidth: number;
    url: string;
  }>;
  audioTracks?: HlsAudioTrack[];
  subtitles?: HlsSubtitleTrack[];
}

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
