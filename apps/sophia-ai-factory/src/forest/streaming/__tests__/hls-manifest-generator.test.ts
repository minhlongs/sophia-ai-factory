/**
 * Unit tests for Adaptive Bitrate HLS Master Manifest Generator
 */

import { describe, it, expect } from 'vitest';
import {
  generateMasterManifest,
  generateMediaPlaylist,
  createHlsMasterManifestData,
  buildDefaultVariants,
} from '../hls-manifest-generator';
import type { HlsAudioTrack, HlsSubtitleTrack } from '@/seed/types/streaming';

describe('hls-manifest-generator (RFC 8216 Adaptive Bitrate HLS Generator)', () => {
  const baseUrl = 'https://cdn.sophia.agencyos.network/videos/vid_001';

  it('generates standard RFC 8216 master playlist with 3-tier quality ladder', () => {
    const manifest = generateMasterManifest({ basePlaybackUrl: baseUrl });

    // Validate headers
    expect(manifest).toContain('#EXTM3U');
    expect(manifest).toContain('#EXT-X-VERSION:6');
    expect(manifest).toContain('#EXT-X-INDEPENDENT-SEGMENTS');

    // 1080p stream
    expect(manifest).toContain('BANDWIDTH=5000000');
    expect(manifest).toContain('RESOLUTION=1920x1080');
    expect(manifest).toContain(`${baseUrl}/1080p/index.m3u8`);

    // 720p stream
    expect(manifest).toContain('BANDWIDTH=2800000');
    expect(manifest).toContain('RESOLUTION=1280x720');
    expect(manifest).toContain(`${baseUrl}/720p/index.m3u8`);

    // 480p stream
    expect(manifest).toContain('BANDWIDTH=1400000');
    expect(manifest).toContain('RESOLUTION=854x480');
    expect(manifest).toContain(`${baseUrl}/480p/index.m3u8`);
  });

  it('correctly associates multi-language audio and subtitle tracks', () => {
    const audioTracks: HlsAudioTrack[] = [
      {
        id: 'audio-vi',
        language: 'vi',
        name: 'Tiếng Việt (Gốc)',
        isDefault: true,
        autoSelect: true,
        uri: `${baseUrl}/audio/vi/index.m3u8`,
      },
      {
        id: 'audio-en',
        language: 'en',
        name: 'English (Dubbed)',
        isDefault: false,
        autoSelect: true,
        uri: `${baseUrl}/audio/en/index.m3u8`,
      },
      {
        id: 'audio-ja',
        language: 'ja',
        name: '日本語 (吹き替え)',
        isDefault: false,
        autoSelect: true,
        uri: `${baseUrl}/audio/ja/index.m3u8`,
      },
    ];

    const subtitles: HlsSubtitleTrack[] = [
      {
        id: 'subs-vi',
        language: 'vi',
        name: 'Tiếng Việt',
        isDefault: true,
        autoSelect: true,
        uri: `${baseUrl}/subtitles/vi.vtt`,
        format: 'vtt',
      },
      {
        id: 'subs-en',
        language: 'en',
        name: 'English',
        isDefault: false,
        autoSelect: false,
        uri: `${baseUrl}/subtitles/en.vtt`,
        format: 'vtt',
      },
    ];

    const manifest = generateMasterManifest({
      basePlaybackUrl: baseUrl,
      audioTracks,
      subtitles,
    });

    // Check Audio media tags
    expect(manifest).toContain('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="Tiếng Việt (Gốc)",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="vi"');
    expect(manifest).toContain('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="English (Dubbed)",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="en"');
    expect(manifest).toContain('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="日本語 (吹き替え)",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="ja"');

    // Check Subtitle media tags
    expect(manifest).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles-vtt",NAME="Tiếng Việt",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="vi"');
    expect(manifest).toContain('#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subtitles-vtt",NAME="English",DEFAULT=NO,AUTOSELECT=NO,LANGUAGE="en"');

    // Check stream variant tags contain AUDIO and SUBTITLES group references
    expect(manifest).toContain('AUDIO="audio-aac"');
    expect(manifest).toContain('SUBTITLES="subtitles-vtt"');
  });

  it('generates valid media segment playlist (.m3u8)', () => {
    const playlist = generateMediaPlaylist({
      targetDurationSec: 6,
      segments: [
        { durationSec: 6.0, uri: 'segment_000.ts' },
        { durationSec: 5.84, uri: 'segment_001.ts' },
        { durationSec: 4.12, uri: 'segment_002.ts' },
      ],
      isVod: true,
    });

    expect(playlist).toContain('#EXTM3U');
    expect(playlist).toContain('#EXT-X-VERSION:3');
    expect(playlist).toContain('#EXT-X-TARGETDURATION:6');
    expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD');
    expect(playlist).toContain('#EXTINF:6.000,');
    expect(playlist).toContain('segment_000.ts');
    expect(playlist).toContain('#EXTINF:5.840,');
    expect(playlist).toContain('segment_001.ts');
    expect(playlist).toContain('#EXT-X-ENDLIST');
  });

  it('createHlsMasterManifestData returns contract conforming object', () => {
    const data = createHlsMasterManifestData('vid_test_123', 'https://sophia.agencyos.network');

    expect(data.masterPlaylistUrl).toBe('https://sophia.agencyos.network/api/videos/vid_test_123/hls');
    expect(data.variants).toHaveLength(3);
    expect(data.variants[0].quality).toBe('1080p');
    expect(data.variants[0].bandwidth).toBe(5000000);
    expect(data.variants[1].quality).toBe('720p');
    expect(data.variants[1].bandwidth).toBe(2800000);
    expect(data.variants[2].quality).toBe('480p');
    expect(data.variants[2].bandwidth).toBe(1400000);
  });

  it('buildDefaultVariants supports relative and absolute base URLs', () => {
    const relative = buildDefaultVariants('');
    expect(relative[0].url).toBe('1080p/index.m3u8');

    const absolute = buildDefaultVariants('https://stream.example.com');
    expect(absolute[0].url).toBe('https://stream.example.com/1080p/index.m3u8');
  });
});
