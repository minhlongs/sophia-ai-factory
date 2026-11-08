/**
 * Word-Timestamp Aligner with R2 cache.
 *
 * Normalizes word-level timestamps produced by faster-whisper / Whisper-style
 * transcribers, builds SRT cues, and caches the aligned payload in R2 under
 * `sha256(voiceId + speed + normalizedText)`.
 *
 * Layer: tree (domain reusable logic)
 * @module tree/video/subtitles/word-timestamp-aligner
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { logger } from '@/seed/utils/logger-utility';

export const ALIGNMENT_CACHE_PREFIX = 'subtitles/cache';

export interface RawTimestampedWord { word: string; start: number; end: number; }
export interface AlignedWord { word: string; start: number; end: number; }
export interface AlignmentCacheKeyInput { voiceId: string; speed: number; text: string; }

export interface AlignmentCacheEntry {
  cacheKey: string; source: 'r2_cache' | 'transcribed'; voiceId: string;
  speed: number; normalizedText: string; durationSec: number; words: AlignedWord[];
}

export interface AlignmentR2BucketLike {
  get(key: string): Promise<{ json(): Promise<unknown> } | null>;
  put(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
}

export interface AlignAudioInput {
  voiceId: string; speed: number; text: string; durationSec?: number;
  words?: RawTimestampedWord[]; audioR2Key?: string;
  transcribe?: (audioR2Key: string) => Promise<RawTimestampedWord[]>;
  wordsPerCue?: number;
}

export interface AlignAudioDeps {
  hashHex?: (value: string) => Promise<string>;
  getBucket?: () => Promise<AlignmentR2BucketLike | null>;
}

export interface SrtCue { index: number; start: number; end: number; text: string; }

/** Lowercase, diacritics & punctuation stripped, whitespace collapsed. */
export function normalizeAlignmentText(rawText: string): string {
  return rawText.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

async function defaultHashHex(value: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto API (crypto.subtle) is unavailable');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function defaultGetBucket(): Promise<AlignmentR2BucketLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as { VIDEO_BUCKET?: AlignmentR2BucketLike }).VIDEO_BUCKET ?? null;
  } catch {
    return null;
  }
}

/** Deterministic R2 cache key: `sha256(voiceId + speed + normalizedText)`. */
export async function computeAlignmentCacheKey(
  input: AlignmentCacheKeyInput,
  deps?: AlignAudioDeps,
): Promise<string> {
  const hashHex = deps?.hashHex ?? defaultHashHex;
  const normalizedText = normalizeAlignmentText(input.text);
  const speed = Number.isFinite(input.speed) && input.speed > 0 ? input.speed : 1;
  return hashHex(`${input.voiceId}:${speed}:${normalizedText}`);
}

/** Enforces monotonic non-negative word timestamps with `end > start` and clamps to `durationSec`. */
export function normalizeWordTimestamps(
  words: readonly RawTimestampedWord[],
  durationSec?: number,
): AlignedWord[] {
  if (!Array.isArray(words) || words.length === 0) return [];
  const cap = typeof durationSec === 'number' && durationSec > 0 ? durationSec : Number.POSITIVE_INFINITY;
  const aligned: AlignedWord[] = [];
  let cursor = 0;

  for (const raw of words) {
    const token = typeof raw?.word === 'string' ? raw.word.trim() : '';
    if (!token) continue;
    const rawStart = Number(raw.start);
    const rawEnd = Number(raw.end);
    const start = Number.isFinite(rawStart) ? Math.max(cursor, rawStart) : cursor;
    const minEnd = start + 0.08;
    const unclampedEnd = Number.isFinite(rawEnd) ? Math.max(minEnd, rawEnd) : minEnd;
    const end = Math.max(0.01, Math.min(cap, unclampedEnd));
    const safeStart = Math.max(0, Math.min(start, end - 0.01));
    aligned.push({
      word: token,
      start: Math.round(safeStart * 100) / 100,
      end: Math.round(end * 100) / 100,
    });
    cursor = aligned[aligned.length - 1].end;
  }
  return aligned;
}

export function formatSrtTimestamp(seconds: number): string {
  const totalMs = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function buildSrtCues(words: readonly AlignedWord[], wordsPerCue = 8): SrtCue[] {
  const size = Math.max(1, Math.floor(wordsPerCue) || 8);
  const cues: SrtCue[] = [];
  for (let i = 0; i < words.length; i += size) {
    const group = words.slice(i, i + size);
    cues.push({
      index: cues.length + 1,
      start: group[0].start,
      end: group[group.length - 1].end,
      text: group.map((w) => w.word).join(' '),
    });
  }
  return cues;
}

export function alignedWordsToSrt(words: readonly AlignedWord[], wordsPerCue = 8): string {
  return buildSrtCues(words, wordsPerCue)
    .map((cue) => `${cue.index}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cue.text}`)
    .join('\n\n');
}

async function readCachedAlignment(
  getBucket: () => Promise<AlignmentR2BucketLike | null>,
  r2Key: string,
  cacheKey: string,
  input: AlignAudioInput,
): Promise<AlignmentCacheEntry | null> {
  try {
    const bucket = await getBucket();
    const obj = bucket ? await bucket.get(r2Key) : null;
    const parsed = (obj ? await obj.json() : null) as Partial<AlignmentCacheEntry> | null;
    if (!parsed || !Array.isArray(parsed.words) || parsed.words.length === 0) return null;
    return {
      cacheKey, source: 'r2_cache',
      voiceId: String(parsed.voiceId ?? input.voiceId),
      speed: Number(parsed.speed ?? input.speed),
      normalizedText: String(parsed.normalizedText ?? normalizeAlignmentText(input.text)),
      durationSec: Number(parsed.durationSec ?? 0),
      words: parsed.words as AlignedWord[],
    };
  } catch (err) {
    logger.warn('[WordTimestampAligner] R2 cache read unavailable', { error: String(err) });
    return null;
  }
}

export async function alignAudioWithR2Cache(
  input: AlignAudioInput,
  deps?: AlignAudioDeps,
): Promise<{ srt: string; entry: AlignmentCacheEntry; cacheHit: boolean }> {
  const cacheKey = await computeAlignmentCacheKey({ voiceId: input.voiceId, speed: input.speed, text: input.text }, deps);
  const getBucket = deps?.getBucket ?? defaultGetBucket;
  const r2Key = `${ALIGNMENT_CACHE_PREFIX}/${cacheKey}.json`;

  const cached = await readCachedAlignment(getBucket, r2Key, cacheKey, input);
  if (cached) {
    return { srt: alignedWordsToSrt(cached.words, input.wordsPerCue), entry: cached, cacheHit: true };
  }

  let rawWords = input.words ?? [];
  if (rawWords.length === 0 && input.audioR2Key && input.transcribe) {
    try { rawWords = (await input.transcribe(input.audioR2Key)) ?? []; }
    catch (err) { logger.warn('[WordTimestampAligner] transcription failed', { error: String(err) }); }
  }

  const words = normalizeWordTimestamps(rawWords, input.durationSec);
  const entry: AlignmentCacheEntry = {
    cacheKey, source: 'transcribed', voiceId: input.voiceId, speed: input.speed,
    normalizedText: normalizeAlignmentText(input.text),
    durationSec: input.durationSec ?? (words.length > 0 ? words[words.length - 1].end : 0),
    words,
  };

  if (words.length > 0) {
    try {
      const bucket = await getBucket();
      if (bucket) await bucket.put(r2Key, JSON.stringify(entry), { httpMetadata: { contentType: 'application/json' } });
    } catch (err) {
      logger.warn('[WordTimestampAligner] R2 cache write failed', { error: String(err) });
    }
  }
  return { srt: alignedWordsToSrt(words, input.wordsPerCue), entry, cacheHit: false };
}
