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

export * from './streaming-events';
