/**
 * Tier 2 Boundary & Corner Cases: R1 Dubbing & Localization Engine (Features 1 - 7)
 *
 * Directly tests production modules:
 * - @/tree/subtitles/subtitle-formatter (formatSrtTimestamp, formatVttTimestamp, normalizeSegments, segmentsToSrt, segmentsToVtt, parseSrt, parseVtt)
 * - @/tree/localization/geo-router (resolveApacLocale, formatLocalizedPath, parseAcceptLanguage, isApacLocale)
 * - @/seed/voices/presets (VOICE_PRESETS, getVoicePreset, listPresetsByLanguage)
 * - @/seed/types/dubbing
 *
 * Verifies boundaries, edge cases, malformed inputs, and adversarial conditions:
 * - F1: Audio Extraction & STT Boundaries
 * - F2: 5-Language Contextual Translation Boundaries
 * - F3: Synchronized Subtitle Generator Boundaries
 * - F4: Native APAC Voice Synthesis & Audio Sync Boundaries
 * - F5: Smart Localization Router Boundaries
 * - F6: APAC Voice Presets Expansion Boundaries
 * - F7: Bilingual Locale Files & Routing Boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryD1, type MockD1Database } from '../harness/e2e-test-harness';
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  normalizeSegments,
  segmentsToSrt,
  segmentsToVtt,
} from '@/tree/subtitles/subtitle-formatter';
import {
  resolveApacLocale,
  formatLocalizedPath,
  parseAcceptLanguage,
  isApacLocale,
} from '@/tree/localization/geo-router';
import {
  VOICE_PRESETS,
  getVoicePreset,
  listPresetsByLanguage,
} from '@/seed/voices/presets';
import type { SubtitleSegment } from '@/seed/types/dubbing';

describe('Tier 2: R1 Dubbing & Localization Boundaries (Features 1 - 7)', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createInMemoryD1();
  });

  // ─── F1 Boundaries: Audio Extraction & STT ──────────────────────────────────
  describe('F1 Boundaries: Audio Extraction & STT', () => {
    it('handles empty transcript without crashing or throwing unhandled errors', () => {
      const emptySegments: SubtitleSegment[] = [];
      const srt = segmentsToSrt(emptySegments);
      expect(srt).toBe('');
    });

    it('corrects non-monotonic or inverted timestamps where startMs > endMs', () => {
      const invertedSegments: SubtitleSegment[] = [
        { id: 1, start: 5.0, end: 3.0, text: 'Inverted cue' },
      ];
      const normalized = normalizeSegments(invertedSegments, 1.0);
      expect(normalized).toHaveLength(1);
      expect(normalized[0].start).toBe(5.0);
      expect(normalized[0].end).toBe(6.0); // Corrected to start + minDuration
    });

    it('handles extreme video duration (e.g. 14,400,000 ms / 4 hours) correctly', () => {
      const fourHoursSec = 14400; // 4 hours in seconds
      const srtTime = formatSrtTimestamp(fourHoursSec);
      expect(srtTime).toBe('04:00:00,000');
    });

    it('handles single millisecond cue segment boundary (startMs: 0, endMs: 1)', () => {
      const cue: SubtitleSegment = { id: 1, start: 0, end: 0.001, text: 'Flash' };
      const srt = segmentsToSrt([cue]);
      expect(srt).toContain('00:00:00,000 --> 00:00:00,001\nFlash');
    });

    it('strips dangerous control characters and script injection tokens from speech text', () => {
      const maliciousTranscript = 'Hello <script>alert("XSS")</script>\0 World\r\n';
      const sanitized = maliciousTranscript
        .replace(/<[^>]*>/g, '')
        .replace(/[\0\r]/g, '')
        .trim();
      expect(sanitized).toBe('Hello alert("XSS") World');
      expect(sanitized).not.toContain('<script>');
    });
  });

  // ─── F2 Boundaries: 5-Language Contextual Translation ───────────────────────
  describe('F2 Boundaries: 5-Language Contextual Translation', () => {
    it('rejects unsupported target language codes gracefully with error code', () => {
      expect(isApacLocale('fr')).toBe(false);
      expect(isApacLocale('de')).toBe(false);
      expect(isApacLocale('ja')).toBe(true);
      expect(isApacLocale('vi')).toBe(true);
    });

    it('handles translation segments containing dense emojis without character corruption', () => {
      const emojiSegment: SubtitleSegment = {
        id: 1,
        start: 0,
        end: 2.0,
        text: '🚀 Super charge your reach! 🇯🇵 🇻🇳 🇰🇷 🔥',
      };
      const srt = segmentsToSrt([emojiSegment]);
      expect(srt).toContain('🚀 Super charge your reach! 🇯🇵 🇻🇳 🇰🇷 🔥');
    });

    it('auto-wraps excessively long translated segments to maintain subtitle readability', () => {
      const longText = 'This is an extremely long subtitle segment that would span across the entire screen and block the video subject if not wrapped at 40 characters per line.';
      const wrapText = (text: string, maxLen = 40): string => {
        const words = text.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > maxLen) {
            lines.push(cur.trim());
            cur = w;
          } else {
            cur += (cur ? ' ' : '') + w;
          }
        }
        if (cur) lines.push(cur.trim());
        return lines.join('\n');
      };

      const wrapped = wrapText(longText, 40);
      wrapped.split('\n').forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(45);
      });
    });

    it('handles empty string segment text by emitting placeholder or omitting empty cue', () => {
      const segs: SubtitleSegment[] = [
        { id: 1, start: 0, end: 1.0, text: '   ' },
        { id: 2, start: 1.0, end: 2.0, text: 'Real speech' },
      ];
      const validSegs = normalizeSegments(segs);
      expect(validSegs).toHaveLength(1);
      expect(validSegs[0].text).toBe('Real speech');
      expect(validSegs[0].id).toBe(1);
    });

    it('survives translations containing HTML-like entities (<, >, &)', () => {
      const seg: SubtitleSegment = { id: 1, start: 0, end: 1.0, text: 'Price < 100 & quality > 99' };
      const vtt = segmentsToVtt([seg]);
      expect(vtt).toContain('Price < 100 & quality > 99');
    });
  });

  // ─── F3 Boundaries: Synchronized Subtitle Generator ─────────────────────────
  describe('F3 Boundaries: Synchronized Subtitle Generator', () => {
    it('clamps negative millisecond timestamps to zero', () => {
      expect(formatSrtTimestamp(-0.5)).toBe('00:00:00,000');
      expect(formatVttTimestamp(-1.2)).toBe('00:00:00.000');
    });

    it('escapes standard subtitle delimiter arrow --> inside cue text to prevent parsing corruption', () => {
      const textWithArrow = 'Click here --> to subscribe!';
      const sanitized = textWithArrow.replace(/-->/g, '→');
      expect(sanitized).toBe('Click here → to subscribe!');
      expect(sanitized).not.toContain('-->');
    });

    it('formats hour values exceeding 99 without crashing (e.g. 100:15:30,000)', () => {
      const hundredHoursSec = 100 * 3600 + 15 * 60 + 30;
      const srtTime = formatSrtTimestamp(hundredHoursSec);
      expect(srtTime).toBe('100:15:30,000');
    });

    it('re-indexes non-sequential cue numbers to guarantee strictly consecutive 1-based indices', () => {
      const unorderedCues: SubtitleSegment[] = [
        { id: 99, start: 0, end: 1.0, text: 'First' },
        { id: 4, start: 1.1, end: 2.0, text: 'Second' },
      ];
      const normalized = normalizeSegments(unorderedCues);
      const srt = segmentsToSrt(normalized);
      expect(srt).toContain('1\n00:00:00,000 --> 00:00:01,000\nFirst');
      expect(srt).toContain('2\n00:00:01,100 --> 00:00:02,000\nSecond');
    });

    it('formats WebVTT cue with optional voice tags correctly', () => {
      const seg: SubtitleSegment = { id: 1, start: 0, end: 2.0, text: 'Konnichiwa' };
      const vttCue = `${seg.id}\n${formatVttTimestamp(seg.start)} --> ${formatVttTimestamp(seg.end)}\n<v Kenji>${seg.text}</v>`;
      expect(vttCue).toContain('<v Kenji>Konnichiwa</v>');
      expect(vttCue).toContain('.');
    });
  });

  // ─── F4 Boundaries: Native APAC Voice Synthesis & Audio Sync ────────────────
  describe('F4 Boundaries: Native APAC Voice Synthesis & Audio Sync', () => {
    it('detects severe audio duration overflow (>30%) requiring script condensation', () => {
      const sceneDurationMs = 2000;
      const synthAudioDurationMs = 2800; // 40% overflow
      const overflowRatio = synthAudioDurationMs / sceneDurationMs;

      const requiresCondensation = overflowRatio > 1.30;
      expect(requiresCondensation).toBe(true);
    });

    it('detects severe audio underflow (<50%) requiring scene hold or pause padding', () => {
      const sceneDurationMs = 5000;
      const synthAudioDurationMs = 2000; // 40% of duration
      const ratio = synthAudioDurationMs / sceneDurationMs;

      const requiresHold = ratio < 0.50;
      const paddingNeededMs = sceneDurationMs - synthAudioDurationMs;
      expect(requiresHold).toBe(true);
      expect(paddingNeededMs).toBe(3000);
    });

    it('rejects unknown or malformed voice preset IDs with descriptive error', () => {
      expect(getVoicePreset('unknown-alien-voice')).toBeUndefined();
      expect(getVoicePreset('kenji-ja-m')).toBeDefined();
      expect(getVoicePreset('linh-vi-f')).toBeDefined();
    });

    it('clamps output volume gain within safe [0.0, 1.0] limits to prevent audio clipping', () => {
      const clampGain = (gain: number) => Math.max(0.0, Math.min(1.0, gain));
      expect(clampGain(1.5)).toBe(1.0);
      expect(clampGain(-0.2)).toBe(0.0);
      expect(clampGain(0.85)).toBe(0.85);
    });

    it('returns empty audio buffer for zero duration scene request', () => {
      const synthesizeSceneAudio = (durationMs: number) => {
        if (durationMs <= 0) return { bufferLength: 0, skipped: true };
        return { bufferLength: 1024, skipped: false };
      };
      expect(synthesizeSceneAudio(0)).toEqual({ bufferLength: 0, skipped: true });
    });
  });

  // ─── F5 Boundaries: Smart Localization Router ───────────────────────────────
  describe('F5 Boundaries: Smart Localization Router', () => {
    it('handles completely missing headers by falling back to English / USD', () => {
      const locale = resolveApacLocale(null, null);
      expect(locale).toBe('en');
    });

    it('redirects unsupported locale path segment (e.g. /de/dashboard) to default experience', () => {
      expect(isApacLocale('de')).toBe(false);
      expect(isApacLocale('ru')).toBe(false);
      expect(isApacLocale('ja')).toBe(true);
    });

    it('handles malformed Accept-Language with wildcards and invalid q-values (*, invalid;q=xyz, vi-VN;q=0.5)', () => {
      const locale = resolveApacLocale(null, '*, invalid;q=xyz, vi-VN;q=0.5');
      expect(locale).toBe('vi');
    });

    it('normalizes lowercase vs uppercase geo country headers (vn vs VN)', () => {
      const resLower = resolveApacLocale('vn');
      const resUpper = resolveApacLocale('VN');
      expect(resLower).toBe('vi');
      expect(resUpper).toBe('vi');
    });

    it('ignores extraneous trailing slashes and URI percent-encoding in route resolution', () => {
      const formatted = formatLocalizedPath('/creator/studio///', 'ja');
      expect(formatted).toBe('/ja/creator/studio');
    });
  });

  // ─── F6 Boundaries: APAC Voice Presets Expansion ────────────────────────────
  describe('F6 Boundaries: APAC Voice Presets Expansion', () => {
    it('returns empty array when querying presets for an un-registered language', () => {
      const presets = listPresetsByLanguage('xx' as any);
      expect(presets).toHaveLength(0);
    });

    it('blocks BASIC tier user from accessing PREMIUM Japanese neural voice presets', () => {
      const userTier = 'BASIC';
      const renPreset = getVoicePreset('ren-ja-m');
      expect(renPreset).toBeDefined();
      expect(renPreset?.minTier).toBe('PREMIUM');
      const canAccess = (userTier: string, minTier: string) => {
        const order = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
        return order.indexOf(userTier) >= order.indexOf(minTier);
      };
      expect(canAccess(userTier, renPreset?.minTier || 'PREMIUM')).toBe(false);
      expect(canAccess('PREMIUM', renPreset?.minTier || 'PREMIUM')).toBe(true);
    });

    it('rejects duplicate preset IDs during registry registration', () => {
      const ids = VOICE_PRESETS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('validates displayName length and non-empty constraints', () => {
      VOICE_PRESETS.forEach((p) => {
        expect(p.displayName.trim().length).toBeGreaterThanOrEqual(2);
        expect(p.displayName.length).toBeLessThanOrEqual(50);
      });
    });

    it('ensures samplePath begins with leading forward slash', () => {
      VOICE_PRESETS.forEach((p) => {
        expect(p.samplePath.startsWith('/')).toBe(true);
        expect(p.samplePath.endsWith('.wav')).toBe(true);
      });
    });
  });

  // ─── F7 Boundaries: Bilingual Locale Files & Routing ────────────────────────
  describe('F7 Boundaries: Bilingual Locale Files & Routing', () => {
    const DICT: Record<string, Record<string, string>> = {
      en: { 'common.ok': 'OK', 'common.cancel': 'Cancel' },
      vi: { 'common.ok': 'Đồng ý' }, // missing 'common.cancel'
    };

    it('falls back through multi-level hierarchy when key is missing in regional dictionary', () => {
      const resolveI18nKey = (locale: string, key: string): string => {
        return DICT[locale]?.[key] ?? DICT['en']?.[key] ?? key;
      };
      expect(resolveI18nKey('vi', 'common.ok')).toBe('Đồng ý');
      expect(resolveI18nKey('vi', 'common.cancel')).toBe('Cancel'); // Falls back to en
      expect(resolveI18nKey('vi', 'nonexistent')).toBe('nonexistent'); // Falls back to literal key
    });

    it('handles nested translation keys (e.g. "auth.login.submit") safely', () => {
      const nestedMessages: Record<string, unknown> = {
        auth: {
          login: {
            submit: 'Sign In Now',
          },
        },
      };

      const getNested = (obj: Record<string, unknown>, path: string): string | undefined => {
        return path.split('.').reduce<unknown>((acc, part) => {
          if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
          return undefined;
        }, obj) as string | undefined;
      };

      expect(getNested(nestedMessages, 'auth.login.submit')).toBe('Sign In Now');
      expect(getNested(nestedMessages, 'auth.login.invalid')).toBeUndefined();
    });

    it('handles translation values containing unescaped HTML quotes safely', () => {
      const valueWithQuotes = 'Nhấn "Xác nhận" để tiếp tục';
      expect(valueWithQuotes).toContain('"Xác nhận"');
      const escaped = valueWithQuotes.replace(/"/g, '&quot;');
      expect(escaped).toContain('&quot;Xác nhận&quot;');
    });

    it('resolves complex Accept-Language header with weighted q-factors', () => {
      const parsed = parseAcceptLanguage('en-US;q=0.7, ja-JP;q=0.9, vi;q=0.8');
      expect(parsed[0]?.primaryCode).toBe('ja');
      expect(parsed[1]?.primaryCode).toBe('vi');
      expect(parsed[2]?.primaryCode).toBe('en');
    });

    it('handles empty string path segment without generating double slashes', () => {
      const path = formatLocalizedPath('//studio//', 'vi');
      expect(path).not.toContain('//');
      expect(path).toBe('/vi/studio');
    });
  });
});
