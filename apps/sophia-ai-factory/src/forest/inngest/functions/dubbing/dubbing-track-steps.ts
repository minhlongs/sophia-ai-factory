/**
 * Dubbing Audio Synthesis and Subtitle Generation Step Helpers
 *
 * Layer: forest (infrastructure orchestrator helper)
 *
 * @module forest/inngest/functions/dubbing/dubbing-track-steps
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  ApacLocale,
  DubbingJobInput,
  TranscriptWord,
} from '@/seed/types/dubbing';
import { wordsToSrt, wordsToVtt } from '@/tree/subtitles/subtitle-formatter';
import { synthesizeEdgeTts, resolveEdgeVoice } from '@/forest/edge-tts/edge-tts-client';
import { mapTranscriptToTarget } from './transcription-aligner';

export async function synthesizeLocaleAudioTracks(params: {
  input: DubbingJobInput;
  transcript: TranscriptWord[];
  translations: Partial<Record<ApacLocale, string>>;
  durationSec: number;
}): Promise<Partial<Record<ApacLocale, string>>> {
  const { input, transcript, translations, durationSec } = params;
  const { jobId, videoId, tenantId, targetLocales } = input;
  const urls: Partial<Record<ApacLocale, string>> = {};

  for (const locale of targetLocales) {
    const textToSpeak = translations[locale] || transcript.map((w) => w.word).join(' ');
    const voice = input.voiceIds?.[locale] || resolveEdgeVoice(locale);

    const synthesisResult = await synthesizeEdgeTts(textToSpeak, locale, {
      voice,
      targetDurationSec: durationSec,
    });

    const audioKey = `tenants/${tenantId}/videos/${videoId}/dubbing/${jobId}/${locale}.mp3`;
    urls[locale] = `https://storage.sophia.agencyos.network/${audioKey}`;

    logger.info('[VideoVoiceDubbing] Synthesized audio track', {
      jobId,
      locale,
      voice: synthesisResult.voice,
      rate: synthesisResult.rate,
      durationSec: synthesisResult.durationSec,
    });
  }

  return urls;
}

export function generateLocaleSubtitleTracks(params: {
  input: DubbingJobInput;
  transcript: TranscriptWord[];
  translations: Partial<Record<ApacLocale, string>>;
}): Partial<Record<ApacLocale, { srt: string; vtt: string }>> {
  const { input, transcript, translations } = params;
  const { jobId, videoId, tenantId, targetLocales } = input;
  const urls: Partial<Record<ApacLocale, { srt: string; vtt: string }>> = {};

  for (const locale of targetLocales) {
    const localizedWords = mapTranscriptToTarget(transcript, translations[locale] || '', locale);
    const srtContent = wordsToSrt(localizedWords);
    const vttContent = wordsToVtt(localizedWords);

    const baseKey = `tenants/${tenantId}/videos/${videoId}/dubbing/${jobId}/subtitles_${locale}`;
    urls[locale] = {
      srt: `https://storage.sophia.agencyos.network/${baseKey}.srt`,
      vtt: `https://storage.sophia.agencyos.network/${baseKey}.vtt`,
    };

    logger.info('[VideoVoiceDubbing] Generated subtitle tracks', {
      jobId,
      locale,
      srtLength: srtContent.length,
      vttLength: vttContent.length,
    });
  }

  return urls;
}
