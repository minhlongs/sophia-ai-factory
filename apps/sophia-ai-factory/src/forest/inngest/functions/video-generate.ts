/**
 * Inngest Function: videoGenerate
 *
 * Registered via `forest/inngest/functions/index.ts` (barrel re-export).
 *
 * Event: 'video/generate.requested'
 * Steps:
 * 1. parse-input — extract prompt + voiceover text
 * 2. generate-tts — ElevenLabs (BYOK) → Fish Speech fallback → upload audio to R2
 * 3. generate-video — HeyGen/D-ID (BYOK) → Wan 2.1 fallback → submit job
 * 4. poll-video-ready — sleep+poll until succeeded/failed
 * 5. download-video — fetch video URL → upload to R2
 * 6. mux-audio-video — Cloudconvert REST API → muxed final.mp4 in R2
 * 7. update-mission — mark engine_mission completed with output URLs
 * 8. emit-usage — log MCU cost via recordCost
 *
 * Operator env vars required: WAN_API_KEY, FISH_SPEECH_API_KEY, CLOUDCONVERT_API_KEY.
 * BYOK env vars (customer-provided): ELEVENLABS_API_KEY, HEYGEN_API_KEY, D_ID_API_KEY.
 * If absent the upstream `generateVideoAction` short-circuits with
 * AI_VIDEO_UNAVAILABLE so this function never runs without keys provisioned.
 */
import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { computeTtsCost, computeVisualCost } from '@/land/video/pipeline-pricing';
import { logger } from '@/seed/utils/logger-utility';
import { muxVideoAudio } from '@/land/video/assembly/ffmpeg-muxer';
import { insertAiPromptVideo } from '@/seed/db/repositories/videos-repo';
import { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { generateSubtitles } from '@/land/video/assembly/subtitle-generator';
import { composeFinalVideo } from '@/land/video/assembly/composer-ffmpeg';
import type { VideoGenerateRequestedEvent } from '@/land/video/templates/types';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getUserRoutingStrategy, getDefaultStrategyForTier } from '@/seed/db/get-user-routing-strategy';
import {
  emitProgress, writeStageCheckpoint,
  getWanClient, getVideoBucket,
  uploadBufferToR2, downloadToBuffer,
} from './video-generate-helpers';
import { executeTtsStep } from './video-generate-tts';
import { executeVisualStep } from './video-generate-poll';

// ── Inngest Function ───────────────────────────────────────────────────────

export const videoGenerate = inngest.createFunction(
  { id: 'video-generate', retries: 2, concurrency: { limit: 3 } },
  { event: 'video/generate.requested' },
  async ({ event, step }) => {
    const data = event.data as VideoGenerateRequestedEvent;

    // ── Idempotency guard: skip if mission already succeeded or running ─────
    const idempotencyDb = createServerClient();
    const { data: existingMission } = await idempotencyDb
      .from('engine_missions')
      .select('id, status')
      .eq('id', data.missionId)
      .single();
    if (existingMission && (existingMission.status === 'succeeded' || existingMission.status === 'running')) {
      logger.info('[videoGenerate] Mission already processed — skipping', { missionId: data.missionId, status: existingMission.status });
      return { skipped: true, missionId: data.missionId };
    }

    await emitProgress(data.missionId, 'tts', 5, 'Bắt đầu tạo video / Starting video generation pipeline');
    // ── Step 1: Parse Input ────────────────────────────────────────────────
    const { missionId, tenantId, userId, prompt, voiceoverText } = await step.run('parse-input', () => {
      if (!data.missionId) throw new Error('[videoGenerate] missionId is required');
      if (!data.prompt) throw new Error('[videoGenerate] prompt is required');
      return {
        missionId: data.missionId,
        tenantId: data.tenantId,
        userId: data.userId,
        prompt: data.prompt,
        voiceoverText: data.voiceoverText ?? data.prompt,
      };
    });

    // ── Resolve routing strategy (not a step — fast DB lookup) ─────────────
    const routingStrategy = await step.run('resolve-routing-strategy', async () => {
      const userStrategy = await getUserRoutingStrategy(userId);
      if (userStrategy) return userStrategy;
      const tier = await getUserTier(userId);
      return getDefaultStrategyForTier(tier);
    }) as string;

    // ── Step 2: Generate TTS (delegated to video-generate-tts) ─────────────
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
    // ── Step 3: Poll Until Video Ready (delegated to video-generate-poll) ──
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
    // ── Step 5: Download + Upload Video to R2 ────────────────────────────
    const videoR2Key = `video-jobs/${missionId}/video.mp4`;
    await step.run('download-video', async () => {
      const videoBuffer = await downloadToBuffer(finalVideoUrl);
      await uploadBufferToR2(videoR2Key, videoBuffer, 'video/mp4');
      logger.info('[videoGenerate] Video uploaded to R2', { videoR2Key });
    });
    await writeStageCheckpoint(missionId, 'download_video', 'completed', tenantId, {
      asset_manifest: { audioR2Key, videoR2Key, brandKitApplied: false, assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }, { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' }] },
    });
    // ── Step 5.5: Generate Subtitles ────────────────────────────────────
    const subtitleSrt = await step.run('generate-subtitles', async () => {
      try {
        const res = await generateSubtitles({ audioR2Key, jobId: missionId });
        return res.srt;
      } catch (err) {
        logger.error('[videoGenerate] Subtitle generation failed (non-fatal)', err instanceof Error ? err : new Error(String(err)));
        return '';
      }
    });
    // ── Step 6: Mux Audio + Video via Cloudconvert or MoviePy Compose ────────
    await emitProgress(missionId, 'compose', 50, 'Đang ghép audio + video / Composing audio and video');
    const muxOutputKey = `video-jobs/${missionId}/final.mp4`;

    const muxed = await step.run('mux-audio-video', async () => {
      const ref = await getVideoBucket();
      const base = ref?.publicBaseUrl?.replace(/\/$/, '') ?? null;
      const videoPublicUrl = base ? `${base}/${videoR2Key}` : videoR2Key;
      const audioPublicUrl = base ? `${base}/${audioR2Key}` : audioR2Key;

      // Check for brand kit — if present with logo, use composeFinalVideo; otherwise mux
      const brandKit = await getBrandKit(userId);
      if (brandKit?.logo_r2_key) {
        const result = await composeFinalVideo({ jobId: missionId, tenantId, audioR2Key, visualR2Key: videoR2Key, subtitleSrt });
        const url = base ? `${base}/${result.finalR2Key}` : result.finalR2Key;
        logger.info('[videoGenerate] composeFinalVideo (brand kit) complete', { missionId, url });
        return { url, durationMs: (result.metadata?.durationSeconds ?? 0) * 1000 };
      }
      const result = await muxVideoAudio({ videoUrl: videoPublicUrl, audioUrl: audioPublicUrl, outputKey: muxOutputKey });
      logger.info('[videoGenerate] mux-audio-video complete', { missionId, finalUrl: result.url, durationMs: result.durationMs });
      return result;
    });
    await emitProgress(missionId, 'compose', 70, 'Ghép hoàn tất / Composition complete');
    await writeStageCheckpoint(missionId, 'mux_audio_video', 'completed', tenantId, {
      render_report: { finalR2Key: muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs, muxedAt: new Date().toISOString(), brandKitApplied: false },
      asset_manifest: { audioR2Key, videoR2Key, brandKitApplied: false, assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }, { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' }, { type: 'video', r2Key: muxOutputKey, mimeType: 'video/mp4' }] },
    });
    // ── Step 7: Update engine_mission ─────────────────────────────────────
    await step.run('update-mission', async () => {
      const db = createServerClient();
      await db.from('engine_missions').update({
        status: 'succeeded',
        result: JSON.stringify({ output_video_url: muxed.url, audio_duration_sec: audioDurationSec }),
        output_video_url: muxed.url,
        output_audio_url: null,
        video_job_id: wanJobId,
        completed_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }).eq('id', missionId);
      logger.info('[videoGenerate] engine_mission updated to succeeded', { missionId });
    });
    await writeStageCheckpoint(missionId, 'update_mission', 'completed', tenantId, {
      render_report: { finalR2Key: muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs, muxedAt: new Date().toISOString(), brandKitApplied: false },
    });
    // ── Insert videos row for gallery ─────────────────────────────────────
    await step.run('insert-videos-row', async () => {
      try {
        const videoId = await insertAiPromptVideo({ userId, missionId, videoUrl: muxed.url, r2Key: muxOutputKey });
        return { videoId };
      } catch (err) {
        logger.error('[videoGenerate] insert-videos-row failed (non-fatal)', err instanceof Error ? err : new Error(String(err)), { missionId });
        return { videoId: null };
      }
    });
    await emitProgress(missionId, 'publish', 80, 'Sẵn sàng xuất bản / Ready for publishing');
    await writeStageCheckpoint(missionId, 'emit_usage', 'completed', tenantId, {
      render_report: { finalR2Key: muxOutputKey, finalUrl: muxed.url, durationMs: muxed.durationMs, muxedAt: new Date().toISOString(), brandKitApplied: false },
    });
    // ── Step 8: Emit Usage ────────────────────────────────────────────────
    await step.run('emit-usage', async () => {
      const ttsCostUsd = computeTtsCost(ttsProvider);
      const visualCostUsd = computeVisualCost(selectedVisualProvider, audioDurationSec);

      const totalCostUsd = ttsCostUsd + visualCostUsd;
      const providers = `tts:${ttsProvider},visual:${selectedVisualProvider}`;

      await recordCost({ jobId: missionId, stage: 'video-generate', provider: providers, units: 1, costUsd: totalCostUsd });
      logger.info('[videoGenerate] Usage cost recorded', { missionId, costUsd: totalCostUsd, ttsCostUsd, visualCostUsd, ttsProvider, visualProvider: selectedVisualProvider });
    });

    await emitProgress(missionId, 'complete', 100, 'Video đã tạo xong / Video generation complete');

    return { missionId, tenantId, userId, audioR2Key, videoR2Key, finalVideoUrl: muxed.url, status: 'succeeded' };
  },
);
