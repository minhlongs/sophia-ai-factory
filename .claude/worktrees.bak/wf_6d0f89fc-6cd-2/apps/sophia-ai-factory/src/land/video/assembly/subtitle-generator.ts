/**
 * Subtitle Generator
 *
 * Transcribes audio from R2 via Cloudflare Workers AI Whisper binding.
 * Returns SRT-formatted subtitle string.
 * Falls back to empty SRT when AI binding is unavailable.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';

export interface GenerateSubtitlesInput {
  audioR2Key: string;
  jobId: string;
}

export interface GenerateSubtitlesResult {
  srt: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperResult {
  text?: string;
  words?: WhisperWord[];
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function wordsToSrt(words: WhisperWord[]): string {
  if (!words.length) return '';
  const entries: string[] = [];
  const chunkSize = 8;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const text = chunk.map((w) => w.word).join(' ');
    const start = formatSrtTime(chunk[0].start);
    const end = formatSrtTime(chunk[chunk.length - 1].end);
    entries.push(`${Math.floor(i / chunkSize) + 1}\n${start} --> ${end}\n${text}`);
  }

  return entries.join('\n\n');
}

/**
 * Generate SRT subtitles from audio stored in R2.
 * Uses CF Workers AI @cf/openai/whisper binding via env.AI.
 */
export async function generateSubtitles(
  input: GenerateSubtitlesInput,
): Promise<GenerateSubtitlesResult> {
  const { audioR2Key, jobId } = input;

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

    const obj = await ref.bucket.get(audioR2Key);
    if (!obj) {
      logger.warn('[SubtitleGenerator] Audio R2 object not found', { jobId, audioR2Key });
      return { srt: '' };
    }

    const audioBuffer = await obj.arrayBuffer();
    const uint8 = new Uint8Array(audioBuffer);
    const result = await ai.run('@cf/openai/whisper', { audio: Array.from(uint8) });

    if (result.words && result.words.length > 0) {
      return { srt: wordsToSrt(result.words) };
    }

    if (result.text) {
      // Fallback: single subtitle block for full text
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
