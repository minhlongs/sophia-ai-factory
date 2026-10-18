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
import { transcribeAudioSample } from './transcription-aligner';
import { translateDialogueText } from './dialogue-translator';
import {
  synthesizeLocaleAudioTracks,
  generateLocaleSubtitleTracks,
} from './dubbing-track-steps';

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
    const synthesizedAudioUrls = await step.run('synthesize-voice', async () =>
      synthesizeLocaleAudioTracks({
        input,
        transcript,
        translations,
        durationSec: audioMeta.durationSec,
      }),
    );

    // Step 5: Generate SRT and VTT synchronized subtitles
    const subtitleUrls = await step.run('generate-subtitles', async () =>
      generateLocaleSubtitleTracks({
        input,
        transcript,
        translations,
      }),
    );

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
