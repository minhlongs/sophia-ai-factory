/**
 * Inngest Function: videoGenerate
 *
 * Registered via `forest/inngest/functions/index.ts` (barrel re-export).
 * Event: 'video/generate.requested'
 */
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { muxVideoAudio } from '@/land/video/assembly/ffmpeg-muxer';
import { generateSubtitles } from '@/land/video/assembly/subtitle-generator';
import { composeFinalVideo } from '@/land/video/assembly/composer-ffmpeg';
import type { VideoGenerateRequestedEvent } from '@/land/video/templates/types';
import { emitProgress, writeStageCheckpoint } from './video-generate-helpers';
import { executeTtsStep } from './video-generate-tts';
import { executeVisualStep } from './video-generate-poll';
import {
  isMissionAlreadyProcessed,
  parseVideoInputStep,
  resolveRoutingStrategyStep,
  downloadAndUploadVideoStep,
  resolveMuxContext,
  writeMuxStageCheckpoint,
} from './video-generate-mux-step';
import {
  updateEngineMission,
  recordGalleryVideo,
  recordGenerationUsage,
} from './video-generate-finalize';

export const videoGenerate = inngest.createFunction(
  { id: 'video-generate', retries: 2, concurrency: { limit: 3 } },
  { event: 'video/generate.requested' },
  async ({ event, step }) => {
    const data = event.data as VideoGenerateRequestedEvent;

    if (await isMissionAlreadyProcessed(data.missionId)) {
      return { skipped: true, missionId: data.missionId };
    }

    await emitProgress(data.missionId, 'tts', 5, 'Bắt đầu tạo video / Starting video generation pipeline');
    const { missionId, tenantId, userId, prompt, voiceoverText } = await step.run('parse-input', () =>
      parseVideoInputStep(data),
    );

    const routingStrategy = (await step.run('resolve-routing-strategy', () =>
      resolveRoutingStrategyStep(userId),
    )) as string;

    const audioR2Key = `video-jobs/${missionId}/audio.mp3`;
    const ttsResult = await step.run('generate-tts', () =>
      executeTtsStep({ userId, tenantId, missionId, audioR2Key, voiceoverText, routingStrategy }),
    );
    const audioDurationSec = ttsResult.durationSec;
    const ttsProvider = ttsResult.ttsProvider;
    await emitProgress(missionId, 'tts', 15, 'Giọng nói đã tổng hợp / TTS synthesis complete');
    await writeStageCheckpoint(missionId, 'generate_tts', 'completed', tenantId, {
      asset_manifest: { audioR2Key, brandKitApplied: false, assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }] },
    });

    await emitProgress(missionId, 'visual', 25, 'Đang tạo video AI / AI video generation in progress');
    const sleepFn = (label: string, ms: number) => step.sleep(label, `${Math.ceil(ms / 1000)}s`);
    const { finalVideoUrl, selectedVisualProvider, wanJobId } = await step.run('poll-video-ready', () =>
      executeVisualStep({ userId, tenantId, missionId, prompt, routingStrategy, sleep: sleepFn }),
    );
    await writeStageCheckpoint(missionId, 'poll_video_ready', 'completed', tenantId, {
      asset_manifest: { audioR2Key, brandKitApplied: false, assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }, { type: 'video', r2Key: '', mimeType: 'video/mp4' }] },
      metadata: { provider: selectedVisualProvider, finalVideoUrl, wanJobId },
    });
    await emitProgress(missionId, 'visual', 40, 'Video AI đã tạo xong / AI video generation complete');

    const videoR2Key = `video-jobs/${missionId}/video.mp4`;
    await step.run('download-video', () => downloadAndUploadVideoStep(finalVideoUrl, videoR2Key));
    await writeStageCheckpoint(missionId, 'download_video', 'completed', tenantId, {
      asset_manifest: { audioR2Key, videoR2Key, brandKitApplied: false, assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }, { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' }] },
    });

    const subtitleSrt = await step.run('generate-subtitles', async () => {
      try {
        const res = await generateSubtitles({ audioR2Key, jobId: missionId });
        return res.srt;
      } catch (err) {
        logger.error('[videoGenerate] Subtitle generation failed (non-fatal)', err instanceof Error ? err : new Error(String(err)));
        return '';
      }
    });

    await emitProgress(missionId, 'compose', 50, 'Đang ghép audio + video / Composing audio and video');
    const muxOutputKey = `video-jobs/${missionId}/final.mp4`;
    const muxed = await step.run('mux-audio-video', async () => {
      const ctx = await resolveMuxContext(userId, videoR2Key, audioR2Key);
      if (ctx.hasBrandKitLogo) {
        const result = await composeFinalVideo({ jobId: missionId, tenantId, audioR2Key, visualR2Key: videoR2Key, subtitleSrt });
        const url = ctx.base ? `${ctx.base}/${result.finalR2Key}` : result.finalR2Key;
        logger.info('[videoGenerate] composeFinalVideo (brand kit) complete', { missionId, url });
        return { url, durationMs: (result.metadata?.durationSeconds ?? 0) * 1000 };
      }
      const result = await muxVideoAudio({ videoUrl: ctx.videoPublicUrl, audioUrl: ctx.audioPublicUrl, outputKey: muxOutputKey });
      logger.info('[videoGenerate] mux-audio-video complete', { missionId, finalUrl: result.url, durationMs: result.durationMs });
      return result;
    });
    await emitProgress(missionId, 'compose', 70, 'Ghép hoàn tất / Composition complete');
    await writeMuxStageCheckpoint({
      missionId, tenantId, audioR2Key, videoR2Key, muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs,
    });

    await step.run('update-mission', () =>
      updateEngineMission({ missionId, muxedUrl: muxed.url, audioDurationSec, wanJobId }),
    );
    await writeStageCheckpoint(missionId, 'update_mission', 'completed', tenantId, {
      render_report: { finalR2Key: muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs, muxedAt: new Date().toISOString(), brandKitApplied: false },
    });

    await step.run('insert-videos-row', () =>
      recordGalleryVideo({ userId, missionId, videoUrl: muxed.url, r2Key: muxOutputKey }),
    );
    await emitProgress(missionId, 'publish', 80, 'Sẵn sàng xuất bản / Ready for publishing');
    await writeStageCheckpoint(missionId, 'emit_usage', 'completed', tenantId, {
      render_report: { finalR2Key: muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs, muxedAt: new Date().toISOString(), brandKitApplied: false },
    });

    await step.run('emit-usage', () =>
      recordGenerationUsage({ missionId, ttsProvider, selectedVisualProvider, audioDurationSec }),
    );

    await emitProgress(missionId, 'complete', 100, 'Video đã tạo xong / Video generation complete');

    return { missionId, tenantId, userId, audioR2Key, videoR2Key, finalVideoUrl: muxed.url, status: 'succeeded' };
  },
);
