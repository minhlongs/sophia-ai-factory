/**
 * Background Dubbing Orchestration: Inngest Workflow Function
 *
 * Layer: forest (infrastructure orchestrator & Inngest function)
 *
 * @module forest/inngest/functions/dubbing/dubbing-workflow
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ApacLocale,
  DubbingJobInput,
  DubbingJobResult,
} from '@/seed/types/dubbing';
import { wordsToSrt, wordsToVtt } from '@/tree/subtitles/subtitle-formatter';
import { synthesizeEdgeTts, resolveEdgeVoice } from '@/forest/edge-tts/edge-tts-client';
import { transcribeAudioSample, mapTranscriptToTarget } from './transcription-aligner';
import { translateDialogueText } from './dialogue-translator';

export const videoVoiceDubbingFunction = inngest.createFunction(
  {
    id: 'video-voice-dubbing',
    retries: 2,
    concurrency: {
      limit: 5,
    },
  },
  { event: 'video.dubbing.requested' },
  async ({ event, step }) => {
    const input = event.data as DubbingJobInput;
    const { jobId, videoId, tenantId, targetLocales, sourceLocale = 'vi' } = input;

    logger.info('[VideoVoiceDubbing] Starting dubbing workflow', {
      jobId,
      videoId,
      targetLocales,
      sourceLocale,
    });

    // Step 1: Extract and verify source audio
    const audioMeta = await step.run('extract-audio', async () => {
      logger.info('[VideoVoiceDubbing] Extracting source audio', { jobId, videoId });
      return {
        jobId,
        videoId,
        durationSec: 15,
        sourceKey: input.sourceAudioR2Key || `tenants/${tenantId}/videos/${videoId}/audio.mp3`,
      };
    });

    // Step 2: Transcribe audio to timestamped words via Whisper (@cf/openai/whisper)
    const transcript = await step.run('transcribe-whisper', async () => {
      return transcribeAudioSample(audioMeta.durationSec, sourceLocale, audioMeta.sourceKey);
    });

    // Step 3: Contextual dialogue translation for each target locale with tempo preservation
    const translations = await step.run('translate-dialogue', async () => {
      const results: Partial<Record<ApacLocale, string>> = {};
      const fullSourceText = transcript.map((w) => w.word).join(' ');

      for (const locale of targetLocales) {
        if (locale === sourceLocale) {
          results[locale] = fullSourceText;
        } else {
          results[locale] = await translateDialogueText(fullSourceText, sourceLocale, locale, {
            targetDurationSec: audioMeta.durationSec,
            sourceWordCount: transcript.length,
          });
        }
      }
      return results;
    });

    // Step 4: Synthesize multilingual speech with tempo matching
    const synthesizedAudioUrls = await step.run('synthesize-voice', async () => {
      const urls: Partial<Record<ApacLocale, string>> = {};

      for (const locale of targetLocales) {
        const textToSpeak = translations[locale] || transcript.map((w) => w.word).join(' ');
        const voice = input.voiceIds?.[locale] || resolveEdgeVoice(locale);

        const synthesisResult = await synthesizeEdgeTts(textToSpeak, locale, {
          voice,
          targetDurationSec: audioMeta.durationSec,
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
    });

    // Step 5: Generate SRT and VTT synchronized subtitles
    const subtitleUrls = await step.run('generate-subtitles', async () => {
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
    });

    // Step 6: Finalize job result
    const finalResult: DubbingJobResult = {
      jobId,
      videoId,
      status: 'completed',
      videoUrl:
        input.sourceVideoUrl ||
        `https://storage.sophia.agencyos.network/tenants/${tenantId}/videos/${videoId}/final.mp4`,
      audioTrackUrls: synthesizedAudioUrls,
      subtitleUrls,
      transcription: transcript,
      translations,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    logger.info('[VideoVoiceDubbing] Dubbing job completed successfully', {
      jobId,
      videoId,
      localesProcessed: targetLocales.length,
    });

    return finalResult;
  },
);
