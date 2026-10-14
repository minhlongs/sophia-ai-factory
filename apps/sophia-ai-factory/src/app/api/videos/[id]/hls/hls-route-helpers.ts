/**
 * Standard multi-language HLS audio and subtitle track builders (VI, EN, JA, KO, TH).
 * @module app/api/videos/[id]/hls/hls-route-helpers
 */

import type { HlsAudioTrack, HlsSubtitleTrack } from '@/seed/types/streaming';

export const HLS_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Range',
};

export function buildStandardAudioTracks(basePlaybackUrl: string): HlsAudioTrack[] {
  return [
    {
      id: 'audio-vi',
      language: 'vi',
      name: 'Tiếng Việt (Gốc)',
      isDefault: true,
      autoSelect: true,
      uri: `${basePlaybackUrl}/audio/vi/index.m3u8`,
    },
    {
      id: 'audio-en',
      language: 'en',
      name: 'English (Dubbed)',
      isDefault: false,
      autoSelect: true,
      uri: `${basePlaybackUrl}/audio/en/index.m3u8`,
    },
    {
      id: 'audio-ja',
      language: 'ja',
      name: '日本語 (吹き替え)',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/audio/ja/index.m3u8`,
    },
    {
      id: 'audio-ko',
      language: 'ko',
      name: '한국어 (더빙)',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/audio/ko/index.m3u8`,
    },
    {
      id: 'audio-th',
      language: 'th',
      name: 'ไทย (พากย์)',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/audio/th/index.m3u8`,
    },
  ];
}

export function buildStandardSubtitleTracks(basePlaybackUrl: string): HlsSubtitleTrack[] {
  return [
    {
      id: 'subs-vi',
      language: 'vi',
      name: 'Tiếng Việt',
      isDefault: true,
      autoSelect: true,
      uri: `${basePlaybackUrl}/subtitles/vi.vtt`,
      format: 'vtt',
    },
    {
      id: 'subs-en',
      language: 'en',
      name: 'English',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/subtitles/en.vtt`,
      format: 'vtt',
    },
    {
      id: 'subs-ja',
      language: 'ja',
      name: '日本語',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/subtitles/ja.vtt`,
      format: 'vtt',
    },
    {
      id: 'subs-ko',
      language: 'ko',
      name: '한국어',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/subtitles/ko.vtt`,
      format: 'vtt',
    },
    {
      id: 'subs-th',
      language: 'th',
      name: 'ไทย',
      isDefault: false,
      autoSelect: false,
      uri: `${basePlaybackUrl}/subtitles/th.vtt`,
      format: 'vtt',
    },
  ];
}
