/**
 * RFC 8216 HLS Media Segment Playlist (.m3u8) Generator and Manifest Data Builder.
 * @module forest/streaming/hls-media-playlist
 */

import type {
  HlsMasterManifest,
  HlsVariantStream,
  HlsAudioTrack,
  HlsSubtitleTrack,
} from '@/seed/types/streaming';

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
 * Constructs an HlsMasterManifest object from pre-built default variants.
 */
export function buildMasterManifestRecord(
  videoId: string,
  basePlaybackUrl: string,
  defaultVariants: HlsVariantStream[],
  options?: {
    audioTracks?: HlsAudioTrack[];
    subtitles?: HlsSubtitleTrack[];
  },
): HlsMasterManifest {
  const cleanBase = basePlaybackUrl.replace(/\/+$/, '');
  const masterPlaylistUrl = `${cleanBase}/api/videos/${encodeURIComponent(videoId)}/hls`;

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
