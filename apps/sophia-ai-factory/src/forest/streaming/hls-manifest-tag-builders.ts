/**
 * RFC 8216 HLS Master Manifest Tag Formatting Helpers
 *
 * Layer: forest/streaming
 * @module forest/streaming/hls-manifest-tag-builders
 */

import type { HlsVariantStream } from '@/seed/types/streaming';

export function buildMediaTrackLines(
  type: 'AUDIO' | 'SUBTITLES',
  groupId: string,
  tracks:
    | Array<{
        name: string;
        isDefault?: boolean;
        autoSelect?: boolean;
        language: string;
        uri: string;
      }>
    | undefined,
): string[] {
  if (!tracks || tracks.length === 0) return [];
  return tracks.map((track) => {
    const isDef = track.isDefault ? 'YES' : 'NO';
    const autoSel = track.autoSelect !== false ? 'YES' : 'NO';
    return `#EXT-X-MEDIA:TYPE=${type},GROUP-ID="${groupId}",NAME="${track.name}",DEFAULT=${isDef},AUTOSELECT=${autoSel},LANGUAGE="${track.language}",URI="${track.uri}"`;
  });
}

export function buildVariantAttrs(
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
