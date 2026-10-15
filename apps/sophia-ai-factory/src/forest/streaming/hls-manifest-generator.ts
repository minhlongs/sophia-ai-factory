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
import { buildMasterManifestRecord } from './hls-media-playlist';

export {
  generateMediaPlaylist,
  type MediaSegment,
  type GenerateMediaPlaylistOptions,
} from './hls-media-playlist';

export interface GenerateMasterManifestOptions {
  basePlaybackUrl?: string;
  variants?: HlsVariantStream[];
  audioTracks?: HlsAudioTrack[];
  subtitles?: HlsSubtitleTrack[];
  independentSegments?: boolean;
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

function buildMediaTrackLines(
  type: 'AUDIO' | 'SUBTITLES',
  groupId: string,
  tracks: Array<{ name: string; isDefault?: boolean; autoSelect?: boolean; language: string; uri: string }> | undefined,
): string[] {
  if (!tracks || tracks.length === 0) return [];
  return tracks.map((track) => {
    const isDef = track.isDefault ? 'YES' : 'NO';
    const autoSel = track.autoSelect !== false ? 'YES' : 'NO';
    return `#EXT-X-MEDIA:TYPE=${type},GROUP-ID="${groupId}",NAME="${track.name}",DEFAULT=${isDef},AUTOSELECT=${autoSel},LANGUAGE="${track.language}",URI="${track.uri}"`;
  });
}

function buildVariantAttrs(
  variant: HlsVariantStream,
  hasAudio: boolean,
  hasSubtitles: boolean,
  audioGroupId: string,
  subsGroupId: string,
): string {
  const attrs: string[] = [`BANDWIDTH=${variant.bandwidth}`];
  if (variant.averageBandwidth) attrs.push(`AVERAGE-BANDWIDTH=${variant.averageBandwidth}`);
  attrs.push(`RESOLUTION=${variant.width}x${variant.height}`);
  if (variant.frameRate) attrs.push(`FRAME-RATE=${variant.frameRate.toFixed(3)}`);
  if (variant.codecs) attrs.push(`CODECS="${variant.codecs}"`);
  if (hasAudio) attrs.push(`AUDIO="${audioGroupId}"`);
  if (hasSubtitles) attrs.push(`SUBTITLES="${subsGroupId}"`);
  return attrs.join(',');
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

  lines.push(...buildMediaTrackLines('AUDIO', audioGroupId, options.audioTracks));
  lines.push(...buildMediaTrackLines('SUBTITLES', subsGroupId, options.subtitles));

  const variants =
    options.variants && options.variants.length > 0
      ? options.variants
      : buildDefaultVariants(options.basePlaybackUrl);
  const hasAudio = Boolean(options.audioTracks && options.audioTracks.length > 0);
  const hasSubtitles = Boolean(options.subtitles && options.subtitles.length > 0);

  for (const variant of variants) {
    lines.push(
      `#EXT-X-STREAM-INF:${buildVariantAttrs(variant, hasAudio, hasSubtitles, audioGroupId, subsGroupId)}`,
    );
    lines.push(variant.url);
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
  return buildMasterManifestRecord(videoId, basePlaybackUrl, buildDefaultVariants(cleanBase), options);
}
