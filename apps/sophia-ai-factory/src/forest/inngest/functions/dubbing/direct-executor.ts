/**
 * Background Dubbing Orchestration: Direct Pipeline Executor
 *
 * Implements standalone in-process execution for test harnesses and edge runtimes.
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/direct-executor
 */

import type {
  ApacLocale,
  DubbingJobInput,
  DubbingJobResult,
} from '@/seed/types/dubbing';
import { wordsToSrt, wordsToVtt } from '@/tree/subtitles/subtitle-formatter';
import { synthesizeEdgeTts, resolveEdgeVoice } from '@/forest/edge-tts/edge-tts-client';
import { transcribeAudioSample, mapTranscriptToTarget } from './transcription-aligner';
import { translateDialogueText } from './dialogue-translator';

/**
 * Execute dubbing pipeline directly (in-process or in test harness).
 */
export async function executeDubbingPipeline(input: DubbingJobInput): Promise<DubbingJobResult> {
  const { jobId, videoId, tenantId, targetLocales, sourceLocale = 'vi' } = input;

  const durationSec = 15;
  const transcript = await transcribeAudioSample(durationSec, sourceLocale, input.sourceAudioR2Key);

  const translations: Partial<Record<ApacLocale, string>> = {};
  const audioTrackUrls: Partial<Record<ApacLocale, string>> = {};
  const subtitleUrls: Partial<Record<ApacLocale, { srt: string; vtt: string }>> = {};

  const fullSourceText = transcript.map((w) => w.word).join(' ');

  for (const locale of targetLocales) {
    // 1. Contextual translation preserving tempo constraints
    const translated =
      locale === sourceLocale
        ? fullSourceText
        : await translateDialogueText(fullSourceText, sourceLocale, locale, {
            targetDurationSec: durationSec,
            sourceWordCount: transcript.length,
          });
    translations[locale] = translated;

    // 2. Synthesize audio
    const voice = input.voiceIds?.[locale] || resolveEdgeVoice(locale);
    await synthesizeEdgeTts(translated, locale, {
      voice,
      targetDurationSec: durationSec,
    });
    audioTrackUrls[locale] = `https://storage.sophia.agencyos.network/tenants/${tenantId}/videos/${videoId}/dubbing/${jobId}/${locale}.mp3`;

    // 3. Format subtitles (SRT & VTT)
    const localizedWords = mapTranscriptToTarget(transcript, translated, locale);
    const srt = wordsToSrt(localizedWords);
    const vtt = wordsToVtt(localizedWords);

    subtitleUrls[locale] = {
      srt: `https://storage.sophia.agencyos.network/tenants/${tenantId}/videos/${videoId}/dubbing/${jobId}/subtitles_${locale}.srt`,
      vtt: `https://storage.sophia.agencyos.network/tenants/${tenantId}/videos/${videoId}/dubbing/${jobId}/subtitles_${locale}.vtt`,
    };

    if (!srt || !vtt) {
      throw new Error(`Failed to generate subtitles for locale: ${locale}`);
    }
  }

  return {
    jobId,
    videoId,
    status: 'completed',
    videoUrl:
      input.sourceVideoUrl ||
      `https://storage.sophia.agencyos.network/tenants/${tenantId}/videos/${videoId}/final.mp4`,
    audioTrackUrls,
    subtitleUrls,
    transcription: transcript,
    translations,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}
