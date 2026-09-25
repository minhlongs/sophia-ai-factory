/**
 * APAC Video Dubbing & Subtitles Engine Comprehensive Test Suite
 *
 * Covers:
 * 1. Subtitle Formatter: SRT/VTT formatting, millisecond precision, monotonic timestamps, edge cases
 * 2. Geo Router: Country code mapping, Accept-Language parsing, quality weighting, fallbacks
 * 3. Voice Presets: JA, KO, TH additions, tier gating, language lookup
 * 4. Edge TTS: Voice resolution, SSML generation, tempo adjustment calculation, synthesis
 * 5. Dubbing Domain Service & Server Action: Validation, state tracking, Inngest dispatch
 * 6. Dubbing Pipeline Execution: Multi-lingual workflow execution
 *
 * @module land/video/__tests__/dubbing-subtitles.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-123'] }),
    createFunction: vi.fn((config, trigger, handler) => ({ config, trigger, handler })),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  parseTimestamp,
  wordsToSrt,
  wordsToVtt,
  parseSrt,
  parseVtt,
  convertSubtitleFormat,
  normalizeSegments,
} from '@/tree/subtitles/subtitle-formatter';
import {
  resolveApacLocale,
  parseAcceptLanguage,
  isApacLocale,
  formatLocalizedPath,
  getCountryDefaultLocale,
} from '@/tree/localization/geo-router';
import {
  VOICE_PRESETS,
  listPresetsByLanguage,
  canAccessPreset,
  getVoicePreset,
} from '@/seed/voices/presets';
import {
  resolveEdgeVoice,
  buildSsml,
  calculateTempoAdjustment,
  synthesizeEdgeTts,
  EDGE_APAC_VOICES,
} from '@/forest/edge-tts/edge-tts-client';
import {
  createDubbingJob,
  getDubbingJobStatus,
  updateDubbingJobResult,
  listDubbingJobsForUser,
} from '../dubbing/dubbing-service';
import { requestDubbingAction } from '../dubbing/actions/request-dubbing-action';
import { executeDubbingPipeline } from '@/forest/inngest/functions/video-voice-dubbing';
import type { TranscriptWord } from '@/seed/types/dubbing';

describe('APAC Video Dubbing & Subtitles Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Subtitle Formatter Tests (SRT / VTT Precision & Monotonic Edge Cases)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Subtitle Formatter (tree/subtitles)', () => {
    it('formats SRT timestamps with comma millisecond precision (HH:MM:SS,mmm)', () => {
      expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
      expect(formatSrtTimestamp(0.005)).toBe('00:00:00,005');
      expect(formatSrtTimestamp(1.234)).toBe('00:00:01,234');
      expect(formatSrtTimestamp(65.5)).toBe('00:01:05,500');
      expect(formatSrtTimestamp(3661.123)).toBe('01:01:01,123');
    });

    it('formats WebVTT timestamps with dot millisecond precision (HH:MM:SS.mmm)', () => {
      expect(formatVttTimestamp(0)).toBe('00:00:00.000');
      expect(formatVttTimestamp(0.005)).toBe('00:00:00.005');
      expect(formatVttTimestamp(1.234)).toBe('00:00:01.234');
      expect(formatVttTimestamp(65.5)).toBe('00:01:05.500');
      expect(formatVttTimestamp(3661.123)).toBe('01:01:01.123');
    });

    it('parses timestamps correctly from both SRT and VTT formats', () => {
      expect(parseTimestamp('00:00:01,500')).toBeCloseTo(1.5, 3);
      expect(parseTimestamp('00:00:01.500')).toBeCloseTo(1.5, 3);
      expect(parseTimestamp('01:30.250')).toBeCloseTo(90.25, 3);
      expect(parseTimestamp('01:02:03.456')).toBeCloseTo(3723.456, 3);
    });

    it('converts transcript words into standard SRT with sequential numbering', () => {
      const words: TranscriptWord[] = [
        { word: 'Xin', start: 0.0, end: 0.3 },
        { word: 'chào', start: 0.4, end: 0.8 },
        { word: 'Việt', start: 0.9, end: 1.2 },
        { word: 'Nam', start: 1.3, end: 1.6 },
      ];

      const srt = wordsToSrt(words, { maxWordsPerChunk: 2 });
      expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,800\nXin chào');
      expect(srt).toContain('2\n00:00:00,900 --> 00:00:01,600\nViệt Nam');
    });

    it('converts transcript words into standard WebVTT starting with WEBVTT header', () => {
      const words: TranscriptWord[] = [
        { word: 'Hello', start: 0.0, end: 0.5 },
        { word: 'world', start: 0.6, end: 1.0 },
      ];

      const vtt = wordsToVtt(words);
      expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
      expect(vtt).toContain('00:00:00.000 --> 00:00:01.000');
      expect(vtt).toContain('Hello world');
    });

    it('handles zero or negative durations by enforcing minCueDurationSec', () => {
      const words: TranscriptWord[] = [
        { word: 'Instant', start: 2.0, end: 2.0 }, // zero duration
        { word: 'Glitch', start: 3.5, end: 2.5 }, // negative duration
      ];

      const segments = normalizeSegments([
        { id: 1, start: 2.0, end: 2.0, text: 'Instant' },
        { id: 2, start: 3.5, end: 2.5, text: 'Glitch' },
      ], 0.5);

      expect(segments[0].end).toBeGreaterThanOrEqual(segments[0].start + 0.5);
      expect(segments[1].end).toBeGreaterThanOrEqual(segments[1].start + 0.5);
    });

    it('clamps negative start timestamps to 0 and sorts disordered cues chronologically', () => {
      const disordered = [
        { id: 2, start: 5.0, end: 7.0, text: 'Later' },
        { id: 1, start: -3.0, end: 2.0, text: 'Negative start' },
      ];

      const normalized = normalizeSegments(disordered, 0.5);
      expect(normalized[0].start).toBe(0);
      expect(normalized[0].text).toBe('Negative start');
      expect(normalized[1].start).toBe(5.0);
      expect(normalized[1].text).toBe('Later');
    });

    it('correctly parses and round-trips SRT and WebVTT', () => {
      const originalSrt = `1\n00:00:01,000 --> 00:00:04,000\nTokyo Night\n\n2\n00:00:04,500 --> 00:00:08,000\nShinjuku Neon`;
      const parsed = parseSrt(originalSrt);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].text).toBe('Tokyo Night');
      expect(parsed[1].text).toBe('Shinjuku Neon');

      const convertedVtt = convertSubtitleFormat(originalSrt, 'srt', 'vtt');
      expect(convertedVtt).toContain('WEBVTT');
      expect(convertedVtt).toContain('00:00:01.000 --> 00:00:04.000');

      const parsedVtt = parseVtt(convertedVtt);
      expect(parsedVtt).toHaveLength(2);
      expect(parsedVtt[0].text).toBe('Tokyo Night');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. APAC Geo Router Tests (tree/localization)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Smart APAC Geo Router (tree/localization)', () => {
    it('maps native APAC country codes to regional locales', () => {
      expect(resolveApacLocale('VN')).toBe('vi');
      expect(resolveApacLocale('JP')).toBe('ja');
      expect(resolveApacLocale('KR')).toBe('ko');
      expect(resolveApacLocale('TH')).toBe('th');
    });

    it('maps international English-speaking APAC hubs to English', () => {
      expect(resolveApacLocale('SG')).toBe('en');
      expect(resolveApacLocale('AU')).toBe('en');
      expect(resolveApacLocale('NZ')).toBe('en');
      expect(resolveApacLocale('US')).toBe('en');
    });

    it('parses RFC 5646 Accept-Language headers and respects quality weights (q-values)', () => {
      const header = 'fr-FR,fr;q=0.9,ja-JP;q=0.8,en;q=0.7';
      const parsed = parseAcceptLanguage(header);

      expect(parsed[0].primaryCode).toBe('fr');
      expect(parsed[0].q).toBe(1.0);
      expect(parsed[1].q).toBe(0.9);
      expect(parsed[2].primaryCode).toBe('ja');
      expect(parsed[2].q).toBe(0.8);
    });

    it('uses browser Accept-Language when client has high preference', () => {
      // User is physically in US but browser explicitly requests Japanese (q=0.95)
      const locale = resolveApacLocale('US', 'ja-JP,ja;q=0.95,en-US;q=0.7');
      expect(locale).toBe('ja');

      // User in Singapore requests Korean
      const localeKr = resolveApacLocale('SG', 'ko-KR,ko;q=1.0,en;q=0.5');
      expect(localeKr).toBe('ko');
    });

    it('falls back to vi for Vietnam geo even with empty Accept-Language', () => {
      expect(resolveApacLocale('VN', '')).toBe('vi');
      expect(resolveApacLocale('VN', undefined)).toBe('vi');
    });

    it('falls back to en for unknown geo and unknown language', () => {
      expect(resolveApacLocale('XX', 'xx-YY,zz;q=0.8')).toBe('en');
      expect(resolveApacLocale(null, null)).toBe('en');
    });

    it('validates supported APAC locales and formats paths', () => {
      expect(isApacLocale('vi')).toBe(true);
      expect(isApacLocale('ja')).toBe(true);
      expect(isApacLocale('ko')).toBe(true);
      expect(isApacLocale('th')).toBe(true);
      expect(isApacLocale('en')).toBe(true);
      expect(isApacLocale('fr')).toBe(false);

      expect(formatLocalizedPath('/pricing', 'ja')).toBe('/ja/pricing');
      expect(formatLocalizedPath('/vi/dashboard', 'ko')).toBe('/ko/dashboard');
      expect(formatLocalizedPath('/', 'th')).toBe('/th');
    });

    it('returns country default locale lookup', () => {
      expect(getCountryDefaultLocale('VN')).toBe('vi');
      expect(getCountryDefaultLocale('jp')).toBe('ja');
      expect(getCountryDefaultLocale('KR')).toBe('ko');
      expect(getCountryDefaultLocale('TH')).toBe('th');
      expect(getCountryDefaultLocale('UNKNOWN')).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. APAC Voice Presets Tests (seed/voices)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Voice Presets Registry (seed/voices)', () => {
    it('contains authentic presets for Japanese (JA)', () => {
      const jaPresets = listPresetsByLanguage('ja');
      expect(jaPresets.length).toBeGreaterThanOrEqual(2);

      const kenji = getVoicePreset('kenji-ja-m');
      expect(kenji).toBeDefined();
      expect(kenji?.language).toBe('ja');
      expect(kenji?.gender).toBe('male');

      const sakura = getVoicePreset('sakura-ja-f');
      expect(sakura).toBeDefined();
      expect(sakura?.language).toBe('ja');
      expect(sakura?.gender).toBe('female');
    });

    it('contains authentic presets for Korean (KO)', () => {
      const koPresets = listPresetsByLanguage('ko');
      expect(koPresets.length).toBeGreaterThanOrEqual(2);

      const minho = getVoicePreset('minho-ko-m');
      expect(minho).toBeDefined();
      expect(minho?.language).toBe('ko');

      const jisoo = getVoicePreset('jisoo-ko-f');
      expect(jisoo).toBeDefined();
      expect(jisoo?.language).toBe('ko');
    });

    it('contains authentic presets for Thai (TH)', () => {
      const thPresets = listPresetsByLanguage('th');
      expect(thPresets.length).toBeGreaterThanOrEqual(2);

      const somchai = getVoicePreset('somchai-th-m');
      expect(somchai).toBeDefined();
      expect(somchai?.language).toBe('th');

      const kanda = getVoicePreset('kanda-th-f');
      expect(kanda).toBeDefined();
      expect(kanda?.language).toBe('th');
    });

    it('enforces tier-based access gating for newly added presets', () => {
      const basicPreset = getVoicePreset('kenji-ja-m')!;
      const premiumPreset = getVoicePreset('ren-ja-m')!;

      expect(canAccessPreset('BASIC', basicPreset)).toBe(true);
      expect(canAccessPreset('BASIC', premiumPreset)).toBe(false);
      expect(canAccessPreset('PREMIUM', premiumPreset)).toBe(true);
      expect(canAccessPreset('ENTERPRISE', premiumPreset)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Edge TTS Gateway Tests (forest/edge-tts)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Edge TTS Gateway (forest/edge-tts)', () => {
    it('resolves correct neural voices across all 5 APAC locales', () => {
      expect(resolveEdgeVoice('vi', 'female')).toBe('vi-VN-HoaiMyNeural');
      expect(resolveEdgeVoice('vi', 'male')).toBe('vi-VN-NamMinhNeural');
      expect(resolveEdgeVoice('ja', 'female')).toBe('ja-JP-NanamiNeural');
      expect(resolveEdgeVoice('ja', 'male')).toBe('ja-JP-KeitaNeural');
      expect(resolveEdgeVoice('ko', 'female')).toBe('ko-KR-SunHiNeural');
      expect(resolveEdgeVoice('ko', 'male')).toBe('ko-KR-InJoonNeural');
      expect(resolveEdgeVoice('th', 'female')).toBe('th-TH-PremwadeeNeural');
      expect(resolveEdgeVoice('th', 'male')).toBe('th-TH-NiwatNeural');
      expect(resolveEdgeVoice('en', 'female')).toBe('en-US-JennyNeural');
    });

    it('constructs valid SSML XML with prosody rate, pitch, and escaping', () => {
      const ssml = buildSsml('Hello & "welcome" <world>', 'vi-VN-HoaiMyNeural', '+15%', '+2Hz', '+0%');
      expect(ssml).toContain('<voice name=\'vi-VN-HoaiMyNeural\'>');
      expect(ssml).toContain('rate=\'+15%\'');
      expect(ssml).toContain('pitch=\'+2Hz\'');
      expect(ssml).toContain('&amp;');
      expect(ssml).toContain('&quot;');
      expect(ssml).toContain('&lt;');
    });

    it('calculates tempo adjustments to match target video scene duration', () => {
      // 10 words spoken at natural 2.5 wps = 4 seconds.
      // Target is 2 seconds -> should speed up by +50% (capped at 50%)
      const fastTempo = calculateTempoAdjustment(2.0, 10, 'en');
      expect(fastTempo).toBe('+50%');

      // 10 words spoken at natural 2.5 wps = 4 seconds.
      // Target is 8 seconds -> should slow down by ~-30%
      const slowTempo = calculateTempoAdjustment(8.0, 10, 'en');
      expect(slowTempo).toBe('-30%');

      // Zero or invalid target duration produces 0% adjustment
      expect(calculateTempoAdjustment(0, 10, 'en')).toBe('+0%');
    });

    it('synthesizes speech and returns valid audio buffer and metadata', async () => {
      const res = await synthesizeEdgeTts('Xin chào thế giới', 'vi');
      expect(res.audioBuffer).toBeInstanceOf(Uint8Array);
      expect(res.audioBuffer.byteLength).toBeGreaterThan(44); // At least WAV/audio header
      expect(res.durationSec).toBeGreaterThan(0);
      expect(res.voice).toBe('vi-VN-HoaiMyNeural');
      expect(res.wordCount).toBe(4);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Dubbing Domain Service & Server Action Tests (land/video/dubbing)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Dubbing Domain Service & Server Action (land/video/dubbing)', () => {
    it('creates a dubbing job and dispatches Inngest event', async () => {
      const { jobId } = await createDubbingJob({
        videoId: 'vid-101',
        targetLocales: ['ja', 'ko', 'th'],
        sourceLocale: 'vi',
        userId: 'user-01',
        tenantId: 'tenant-01',
      });

      expect(jobId).toMatch(/^dub_/);
      expect(inngest.send).toHaveBeenCalledTimes(1);
      const call = vi.mocked(inngest.send).mock.calls[0][0] as { name: string; data: { videoId: string } };
      expect(call.name).toBe('video.dubbing.requested');
      expect(call.data.videoId).toBe('vid-101');

      const status = await getDubbingJobStatus(jobId);
      expect(status).not.toBeNull();
      expect(status?.status).toBe('pending');
      expect(status?.videoId).toBe('vid-101');
    });

    it('updates dubbing job status and results', async () => {
      const { jobId } = await createDubbingJob({
        videoId: 'vid-102',
        targetLocales: ['ja'],
        userId: 'user-02',
        tenantId: 'tenant-02',
      });

      await updateDubbingJobResult(jobId, {
        status: 'completed',
        audioTrackUrls: { ja: 'https://cdn.example.com/audio_ja.mp3' },
        subtitleUrls: {
          ja: {
            srt: 'https://cdn.example.com/sub_ja.srt',
            vtt: 'https://cdn.example.com/sub_ja.vtt',
          },
        },
      });

      const updated = await getDubbingJobStatus(jobId);
      expect(updated?.status).toBe('completed');
      expect(updated?.audioTrackUrls.ja).toBe('https://cdn.example.com/audio_ja.mp3');
      expect(updated?.completedAt).toBeDefined();
    });

    it('rejects unauthenticated requests in requestDubbingAction', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const result = await requestDubbingAction({
        videoId: 'vid-999',
        targetLocales: ['vi', 'ja'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('UNAUTHENTICATED');
    });

    it('validates input schema and rejects empty targetLocales in requestDubbingAction', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-1',
        email: 'user@example.com',
        tenantId: 'ten-1',
      } as never);

      const result = await requestDubbingAction({
        videoId: 'vid-999',
        targetLocales: [] as never,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('INVALID_INPUT');
    });

    it('successfully processes valid requestDubbingAction for authenticated user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'usr-42',
        email: 'creator@sophia.io',
        tenantId: 'tenant-apac-1',
      } as never);

      const result = await requestDubbingAction({
        videoId: 'video-apac-2026',
        targetLocales: ['ja', 'ko', 'th', 'en'],
        sourceLocale: 'vi',
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Dubbing Pipeline Direct Execution Tests (forest/inngest)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Dubbing Pipeline Direct Execution (forest/inngest)', () => {
    it('executes full 5-language dubbing workflow and emits multi-track audio and SRT/VTT subtitles', async () => {
      const result = await executeDubbingPipeline({
        jobId: 'dub-e2e-001',
        videoId: 'vid-demo-01',
        targetLocales: ['vi', 'en', 'ja', 'ko', 'th'],
        sourceLocale: 'vi',
        tenantId: 'tenant-test',
        userId: 'user-test',
      });

      expect(result.status).toBe('completed');
      expect(result.jobId).toBe('dub-e2e-001');

      // Verify all 5 APAC languages have synthesized audio tracks
      expect(result.audioTrackUrls.vi).toBeDefined();
      expect(result.audioTrackUrls.en).toBeDefined();
      expect(result.audioTrackUrls.ja).toBeDefined();
      expect(result.audioTrackUrls.ko).toBeDefined();
      expect(result.audioTrackUrls.th).toBeDefined();

      // Verify all 5 APAC languages have both SRT and VTT subtitles
      expect(result.subtitleUrls.vi?.srt).toContain('.srt');
      expect(result.subtitleUrls.vi?.vtt).toContain('.vtt');
      expect(result.subtitleUrls.ja?.srt).toContain('.srt');
      expect(result.subtitleUrls.ja?.vtt).toContain('.vtt');
      expect(result.subtitleUrls.ko?.srt).toContain('.srt');
      expect(result.subtitleUrls.ko?.vtt).toContain('.vtt');
      expect(result.subtitleUrls.th?.srt).toContain('.srt');
      expect(result.subtitleUrls.th?.vtt).toContain('.vtt');

      // Verify translations exist
      expect(result.translations?.ja).toContain('ソフィア');
      expect(result.translations?.ko).toContain('소피아');
      expect(result.translations?.th).toContain('Sophia');
    });
  });
});
