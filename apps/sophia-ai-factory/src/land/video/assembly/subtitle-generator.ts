/**
 * Subtitle Generator
 *
 * Transcribes audio from R2 via Cloudflare Workers AI Whisper binding,
 * normalizes word-level timestamps, and supports deterministic R2 alignment
 * caching keyed on `sha256(voiceId + speed + normalizedText)`.
 * Falls back to empty SRT when AI binding is unavailable.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';
import {
  alignAudioWithR2Cache,
  alignedWordsToSrt,
  normalizeWordTimestamps,
  type RawTimestampedWord,
} from '@/tree/video/subtitles/word-timestamp-aligner';

export interface GenerateSubtitlesInput {
  audioR2Key: string;
  jobId: string;
  voiceId?: string;
  speed?: number;
  text?: string;
  durationSec?: number;
}

export interface GenerateSubtitlesResult {
  srt: string;
  cacheHit?: boolean;
}

interface WhisperResult {
  text?: string;
  words?: RawTimestampedWord[];
}

/**
 * Generate SRT subtitles from audio stored in R2.
 * Uses CF Workers AI @cf/openai/whisper binding via env.AI and normalizes
 * word-level timestamps through `@/tree/video/subtitles/word-timestamp-aligner`.
 */
export async function generateSubtitles(
  input: GenerateSubtitlesInput,
): Promise<GenerateSubtitlesResult> {
  const { audioR2Key, jobId, voiceId, speed = 1, text, durationSec } = input;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as { AI?: { run: (model: string, input: object) => Promise<WhisperResult> } }).AI;
    if (!ai) {
      logger.warn('[SubtitleGenerator] AI binding not available', { jobId });
      return { srt: '' };
    }

    const ref = await getVideoBucket();
    if (!ref) {
      logger.warn('[SubtitleGenerator] VIDEO_BUCKET not available', { jobId });
      return { srt: '' };
    }

    let cachedWhisper: WhisperResult | null = null;
    const runWhisperOnce = async (r2Key: string): Promise<WhisperResult | null> => {
      if (cachedWhisper) return cachedWhisper;
      const obj = await ref.bucket.get(r2Key);
      if (!obj) return null;
      const uint8 = new Uint8Array(await obj.arrayBuffer());
      cachedWhisper = await ai.run('@cf/openai/whisper', { audio: Array.from(uint8) });
      return cachedWhisper;
    };

    if (voiceId && text) {
      const aligned = await alignAudioWithR2Cache(
        {
          voiceId,
          speed,
          text,
          durationSec,
          audioR2Key,
          transcribe: async (r2Key) => (await runWhisperOnce(r2Key))?.words ?? [],
        },
        {
          getBucket: async () => ref.bucket as unknown as {
            get(key: string): Promise<{ json(): Promise<unknown> } | null>;
            put(key: string, value: string, options?: Record<string, unknown>): Promise<unknown>;
          },
        },
      );
      if (aligned.srt) {
        return { srt: aligned.srt, cacheHit: aligned.cacheHit };
      }
    }

    const result = await runWhisperOnce(audioR2Key);
    if (!result) {
      logger.warn('[SubtitleGenerator] Audio R2 object not found', { jobId, audioR2Key });
      return { srt: '' };
    }

    if (result.words && result.words.length > 0) {
      const normalized = normalizeWordTimestamps(result.words, durationSec);
      return { srt: alignedWordsToSrt(normalized) };
    }

    if (result.text) {
      return {
        srt: `1\n00:00:00,000 --> 00:00:30,000\n${result.text}`,
      };
    }

    return { srt: '' };
  } catch (err) {
    logger.warn('[SubtitleGenerator] Whisper transcription failed', { jobId, error: String(err) });
    return { srt: '' };
  }
}
