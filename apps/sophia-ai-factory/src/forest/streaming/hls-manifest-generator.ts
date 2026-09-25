/**
 * Adaptive Bitrate HLS Master Manifest (.m3u8) Generator
 *
 * Implements RFC 8216 (HTTP Live Streaming) master and media playlist generation
 * for Cloudflare Stream and R2 Edge CDN video caching.
 *
 * 3-Tier Multi-Bitrate Ladder:
 * - 1080p: 5000 kbps (1920x1080 @ 30fps) - AVC High / AAC
 * - 720p:  2800 kbps (1280x720 @ 30fps)  - AVC Main / AAC
 * - 480p:  1400 kbps (854x480 @ 30fps)   - AVC Baseline / AAC
 *
 * Layer: forest/streaming (Infrastructure generator)
 * Dependencies: seed/types/streaming (0 land imports)
 *
 * @module forest/streaming/hls-manifest-generator
 */

import {
  QUALITY_LADDER_PRESETS,
  type QualityLadder,
  type HlsMasterManifest,
  type HlsVariantStream,
  type HlsAudioTrack,
  type HlsSubtitleTrack,
} from '@/seed/types/streaming';

export interface GenerateMasterManifestOptions {
  basePlaybackUrl?: string;
  variants?: HlsVariantStream[];
  audioTracks?: HlsAudioTrack[];
  subtitles?: HlsSubtitleTrack[];
  independentSegments?: boolean;
}

export interface MediaSegment {
  durationSec: number;
  uri: string;
  title?: string;
}

export interface GenerateMediaPlaylistOptions {
  targetDurationSec: number;
  segments: MediaSegment[];
  isVod?: boolean;
  mediaSequence?: number;
}

/**
 * Builds default 3-tier variant streams referencing resolution endpoints.
 */
export function buildDefaultVariants(baseUrl: string = ''): HlsVariantStream[] {
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  const ladders: QualityLadder[] = ['1080p', '720p', '480p'];

  return ladders.map((quality) => {
    const preset = QUALITY_LADDER_PRESETS[quality];
    const relUri = `${quality}/index.m3u8`;
    const fullUrl = cleanBase ? `${cleanBase}/${relUri}` : relUri;

    return {
      quality,
      bandwidth: preset.bandwidth,
      averageBandwidth: preset.averageBandwidth,
      width: preset.width,
      height: preset.height,
      frameRate: preset.frameRate,
      codecs: preset.codecs,
      url: fullUrl,
      uri: relUri,
    };
  });
}

/**
 * Generates an RFC 8216 compliant HLS Master Playlist string (.m3u8).
 */
export function generateMasterManifest(options: GenerateMasterManifestOptions = {}): string {
  const lines: string[] = ['#EXTM3U', '#EXT-X-VERSION:6'];

  if (options.independentSegments ?? true) {
    lines.push('#EXT-X-INDEPENDENT-SEGMENTS');
  }

  const audioGroupId = 'audio-aac';
  const subsGroupId = 'subtitles-vtt';

  // 1. Audio Track Signaling (#EXT-X-MEDIA:TYPE=AUDIO)
  if (options.audioTracks && options.audioTracks.length > 0) {
    for (const track of options.audioTracks) {
      const isDef = track.isDefault ? 'YES' : 'NO';
      const autoSel = track.autoSelect !== false ? 'YES' : 'NO';
      lines.push(
        `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="${audioGroupId}",NAME="${track.name}",DEFAULT=${isDef},AUTOSELECT=${autoSel},LANGUAGE="${track.language}",URI="${track.uri}"`
      );
    }
  }

  // 2. Subtitle Track Signaling (#EXT-X-MEDIA:TYPE=SUBTITLES)
  if (options.subtitles && options.subtitles.length > 0) {
    for (const sub of options.subtitles) {
      const isDef = sub.isDefault ? 'YES' : 'NO';
      const autoSel = sub.autoSelect !== false ? 'YES' : 'NO';
      lines.push(
        `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="${subsGroupId}",NAME="${sub.name}",DEFAULT=${isDef},AUTOSELECT=${autoSel},LANGUAGE="${sub.language}",URI="${sub.uri}"`
      );
    }
  }

  // 3. Variant Stream Definitions (#EXT-X-STREAM-INF)
  const variants = options.variants && options.variants.length > 0
    ? options.variants
    : buildDefaultVariants(options.basePlaybackUrl);

  for (const variant of variants) {
    const attrs: string[] = [
      `BANDWIDTH=${variant.bandwidth}`,
    ];

    if (variant.averageBandwidth) {
      attrs.push(`AVERAGE-BANDWIDTH=${variant.averageBandwidth}`);
    }

    attrs.push(`RESOLUTION=${variant.width}x${variant.height}`);

    if (variant.frameRate) {
      attrs.push(`FRAME-RATE=${variant.frameRate.toFixed(3)}`);
    }

    if (variant.codecs) {
      attrs.push(`CODECS="${variant.codecs}"`);
    }

    if (options.audioTracks && options.audioTracks.length > 0) {
      attrs.push(`AUDIO="${audioGroupId}"`);
    }

    if (options.subtitles && options.subtitles.length > 0) {
      attrs.push(`SUBTITLES="${subsGroupId}"`);
    }

    lines.push(`#EXT-X-STREAM-INF:${attrs.join(',')}`);
    lines.push(variant.url);
  }

  return lines.join('\n') + '\n';
}

/**
 * Generates an RFC 8216 compliant HLS Media Segment Playlist (.m3u8).
 */
export function generateMediaPlaylist(options: GenerateMediaPlaylistOptions): string {
  const lines: string[] = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${Math.ceil(options.targetDurationSec)}`,
    `#EXT-X-MEDIA-SEQUENCE:${options.mediaSequence ?? 0}`,
  ];

  if (options.isVod !== false) {
    lines.push('#EXT-X-PLAYLIST-TYPE:VOD');
  }

  for (const segment of options.segments) {
    lines.push(`#EXTINF:${segment.durationSec.toFixed(3)},${segment.title ?? ''}`);
    lines.push(segment.uri);
  }

  if (options.isVod !== false) {
    lines.push('#EXT-X-ENDLIST');
  }

  return lines.join('\n') + '\n';
}

/**
 * Constructs an HlsMasterManifest object conforming to PROJECT.md contract.
 */
export function createHlsMasterManifestData(
  videoId: string,
  basePlaybackUrl: string,
  options?: {
    audioTracks?: HlsAudioTrack[];
    subtitles?: HlsSubtitleTrack[];
  }
): HlsMasterManifest {
  const cleanBase = basePlaybackUrl.replace(/\/+$/, '');
  const masterPlaylistUrl = `${cleanBase}/api/videos/${encodeURIComponent(videoId)}/hls`;
  const defaultVariants = buildDefaultVariants(cleanBase);

  return {
    masterPlaylistUrl,
    variants: defaultVariants.map((v) => ({
      quality: v.quality,
      bandwidth: v.bandwidth,
      url: v.url,
    })),
    audioTracks: options?.audioTracks,
    subtitles: options?.subtitles,
  };
}
