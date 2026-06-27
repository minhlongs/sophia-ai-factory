/**
 * Inngest Function: videoGenerate
 *
 * Registered via `forest/inngest/functions/index.ts` (barrel re-export).
 *
 * Event: 'video/generate.requested'
 * Steps:
 * 1. parse-input — extract prompt + voiceover text
 * 2. generate-tts — Fish Speech → upload audio to R2
 * 3. generate-video — Wan 2.1 submit job
 * 4. poll-video-ready — sleep+poll until succeeded/failed
 * 5. download-video — fetch video URL → upload to R2
 * 6. mux-audio-video — Cloudconvert REST API → muxed final.mp4 in R2
 * 7. update-mission — mark engine_mission completed with output URLs
 * 8. emit-usage — log MCU cost via recordCost
 *
 * Operator env vars required: WAN_API_KEY, FISH_SPEECH_API_KEY, CLOUDCONVERT_API_KEY.
 * If absent the upstream `generateVideoAction` short-circuits with
 * AI_VIDEO_UNAVAILABLE so this function never runs without keys provisioned.
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { recordCost } from '@/land/video/templates/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { WanVideoClient } from '@/land/video/generation/wan21-client';
import { FishSpeechClient } from '@/land/video/generation/fish-speech-client';
import { muxVideoAudio } from '@/land/video/assembly/ffmpeg-muxer';
import { insertAiPromptVideo } from '@/seed/db/repositories/videos-repo';
import { getBrandKit } from '@/seed/db/repositories/brand-kits-repo';
import { generateSubtitles } from '@/land/video/assembly/subtitle-generator';
import { composeFinalVideo, applyBrandKit } from '@/land/video/assembly/composer-ffmpeg';
import { CheckpointService } from '@/forest/pipeline';
import type { VideoGenerateRequestedEvent, ProviderVideoJobStatus } from '@/land/video/templates/types';

/** Progress payload emitted via inngest.send for SSE streaming */
interface ProgressPayload {
  type: 'campaign.progress';
  campaignId: string;
  step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
  progress: number;
  message: string;
  timestamp: number;
}

/**
 * Emit a campaign.progress event for SSE subscribers.
 * Uses inngest.send() for cross-function event delivery.
 */
async function emitProgress(
  campaignId: string,
  step: ProgressPayload['step'],
  progress: number,
  message: string,
): Promise<void> {
  const payload: ProgressPayload = {
    type: 'campaign.progress',
    campaignId,
    step,
    progress,
    message,
    timestamp: Date.now(),
  };
  await inngest.send({
    id: `progress-${campaignId}-${step}-${payload.timestamp}`,
    name: 'campaign.progress',
    data: payload,
  });
  logger.info('[videoGenerate] Progress emitted', { campaignId, step, progress, message });
}

const POLL_INTERVAL_MS = 20_000; // 20s between polls
const POLL_MAX_ATTEMPTS = 18; // 18 × 20s = 6 min max wait

/**
 * Write a non-blocking checkpoint for the current pipeline stage.
 * Failures are logged but never thrown — checkpoint is observability, not control flow.
 */
async function writeStageCheckpoint(
  pipelineId: string,
  stage: string,
  status: 'in_progress' | 'completed' | 'failed' | 'skipped',
  tenantId: string,
  artifacts: Record<string, unknown> = {},
  error?: string,
): Promise<void> {
  try {
    const svc = new CheckpointService(tenantId);
    await svc.writeCheckpoint(pipelineId, stage, status, artifacts, {
      pipelineType: 'video_generation',
      error,
    });
  } catch (err) {
    logger.warn('[videoGenerate] Checkpoint write failed (non-fatal)', {
      pipelineId,
      stage,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function getWanClient(): WanVideoClient {
  const apiKey = process.env.WAN_API_KEY;
  if (!apiKey) throw new Error('[videoGenerate] WAN_API_KEY not configured');
  return new WanVideoClient({ apiKey });
}

function getFishSpeechClient(): FishSpeechClient {
  const apiKey = process.env.FISH_SPEECH_API_KEY;
  if (!apiKey) throw new Error('[videoGenerate] FISH_SPEECH_API_KEY not configured');
  return new FishSpeechClient({ apiKey });
}

async function uploadBufferToR2(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const ref = await getVideoBucket();
  if (!ref) {
    logger.warn('[videoGenerate] R2 bucket not available — skipping upload', { key });
    return;
  }
  await ref.bucket.put(key, data, { httpMetadata: { contentType } });
}

async function downloadToBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`[videoGenerate] Failed to download from ${url}: ${res.status}`);
  }
  return res.arrayBuffer();
}

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

    // Emit: pipeline started
    await emitProgress(data.missionId, 'tts', 5, 'Bắt đầu tạo video / Starting video generation pipeline');

    // ── Step 1: Parse Input ────────────────────────────────────────────────
    const { missionId, prompt, voiceoverText, tenantId, userId, language } = await step.run('parse-input', async () => {
      if (!data.missionId) throw new Error('[videoGenerate] missionId is required');
      if (!data.prompt) throw new Error('[videoGenerate] prompt is required');
      return {
        missionId: data.missionId,
        prompt: data.prompt,
        voiceoverText: data.voiceoverText ?? data.prompt,
        tenantId: data.tenantId,
        userId: data.userId,
        language: data.language ?? 'en',
      };
    });

    // Checkpoint: parse-input completed
    await writeStageCheckpoint(missionId, 'parse_input', 'completed', tenantId, {
      research_brief: { prompt, voiceoverText, language },
    });

    // ── Step 2: Generate TTS ───────────────────────────────────────────────
    const audioR2Key = `video-jobs/${missionId}/audio.mp3`;

    const audioDurationSec = await step.run('generate-tts', async () => {
      const ttsClient = getFishSpeechClient();
      const { audioUrl, durationSec } = await ttsClient.generateSpeech({
        text: voiceoverText,
        language,
      });

      const audioBuffer = await downloadToBuffer(audioUrl);
      await uploadBufferToR2(audioR2Key, audioBuffer, 'audio/mpeg');

      logger.info('[videoGenerate] Audio uploaded to R2', { audioR2Key, durationSec });
      return durationSec;
    });

    // Emit: TTS complete (15%)
    await emitProgress(missionId, 'tts', 15, 'Giọng nói đã tổng hợp / TTS synthesis complete');

    // Checkpoint: generate-tts completed
    await writeStageCheckpoint(missionId, 'generate_tts', 'completed', tenantId, {
      asset_manifest: {
        audioR2Key,
        brandKitApplied: false,
        assets: [{ type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' }],
      },
    });

    // ── Step 3: Submit Video Generation ───────────────────────────────────
    const result1 = await step.run('generate-video', async () => {
      const wanClient = getWanClient();
      const { jobId } = await wanClient.generateVideo({ prompt });
      logger.info('[videoGenerate] Wan 2.1 job submitted', { wanJobId: jobId });
      return { wanJobId: jobId };
    });
    const wanJobId = result1.wanJobId;

    // Emit: video generation submitted (25%)
    await emitProgress(missionId, 'visual', 25, 'Đang tạo video AI / AI video generation in progress');

    // Checkpoint: generate-video submitted
    await writeStageCheckpoint(missionId, 'generate_video', 'completed', tenantId, {
      asset_manifest: {
        audioR2Key,
        brandKitApplied: false,
        assets: [
          { type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' },
          { type: 'video', r2Key: '', mimeType: 'video/mp4' },
        ],
      },
      metadata: { wanJobId },
    });

    // ── Step 4: Poll Until Video Ready ────────────────────────────────────
    let finalVideoUrl: string | undefined;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await step.sleep(`poll-wait-${attempt}`, POLL_INTERVAL_MS);

      const statusResult = await step.run(`poll-video-status-${attempt}`, async () => {
        const wanClient = getWanClient();
        return wanClient.getJobStatus(wanJobId);
      }) as ProviderVideoJobStatus;

      if (statusResult.status === 'succeeded' && statusResult.videoUrl) {
        finalVideoUrl = statusResult.videoUrl;
        break;
      }
      if (statusResult.status === 'failed' || statusResult.status === 'canceled') {
        await emitProgress(missionId, 'error', 0, `Lỗi tạo video / Video generation failed: ${statusResult.status}`);
        await writeStageCheckpoint(missionId, 'poll_video_ready', 'failed', tenantId, {}, statusResult.status);
        throw new Error(
          `[videoGenerate] Wan job ${wanJobId} ended with status: ${statusResult.status} — ${statusResult.error ?? ''}`,
        );
      }
    }

    if (!finalVideoUrl) {
      await emitProgress(missionId, 'error', 0, `Hết thời gian chờ / Video generation timed out after ${POLL_MAX_ATTEMPTS} polls`);
      await writeStageCheckpoint(missionId, 'poll_video_ready', 'failed', tenantId, {}, 'timeout');
      throw new Error(`[videoGenerate] Wan job ${wanJobId} did not complete after ${POLL_MAX_ATTEMPTS} polls`);
    }

    // Checkpoint: poll-video-ready succeeded
    await writeStageCheckpoint(missionId, 'poll_video_ready', 'completed', tenantId, {
      asset_manifest: {
        audioR2Key,
        brandKitApplied: false,
        assets: [
          { type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' },
          { type: 'video', r2Key: '', mimeType: 'video/mp4' },
        ],
      },
      metadata: { wanJobId, finalVideoUrl },
    });

    // Emit: video generation complete (40%)
    await emitProgress(missionId, 'visual', 40, 'Video AI đã tạo xong / AI video generation complete');

    // ── Step 5: Download + Upload Video to R2 ────────────────────────────
    const videoR2Key = `video-jobs/${missionId}/video.mp4`;

    await step.run('download-video', async () => {
      const videoBuffer = await downloadToBuffer(finalVideoUrl!);
      await uploadBufferToR2(videoR2Key, videoBuffer, 'video/mp4');
      logger.info('[videoGenerate] Video uploaded to R2', { videoR2Key });
    });

    // Checkpoint: download-video completed
    await writeStageCheckpoint(missionId, 'download_video', 'completed', tenantId, {
      asset_manifest: {
        audioR2Key,
        videoR2Key,
        brandKitApplied: false,
        assets: [
          { type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' },
          { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' },
        ],
      },
    });

    // ── Step 5.5: Generate Subtitles ────────────────────────────────────
    const subtitleSrt = await step.run('generate-subtitles', async () => {
      try {
        const res = await generateSubtitles({
          audioR2Key,
          jobId: missionId,
        });
        return res.srt;
      } catch (err) {
        logger.error('[videoGenerate] Subtitle generation failed (non-fatal)', err instanceof Error ? err : new Error(String(err)));
        return '';
      }
    });

    // Emit: composing started (50%)
    await emitProgress(missionId, 'compose', 50, 'Đang ghép audio + video / Composing audio and video');

    // ── Step 6: Mux Audio + Video via Cloudconvert or MoviePy Compose ────────
    const muxOutputKey = `video-jobs/${missionId}/final.mp4`;

    const muxed = await step.run('mux-audio-video', async () => {
      const ref = await getVideoBucket();
      const base = ref?.publicBaseUrl?.replace(/\/$/, '') ?? null;

      const videoPublicUrl = base ? `${base}/${videoR2Key}` : videoR2Key;
      const audioPublicUrl = base ? `${base}/${audioR2Key}` : audioR2Key;

      const targetUserId = userId || tenantId;
      const brandKit = await getBrandKit(targetUserId);

      const hasBrandKit = brandKit && (
        brandKit.logo_r2_key ||
        brandKit.intro_r2_key ||
        brandKit.outro_r2_key ||
        brandKit.primary_color ||
        brandKit.font_r2_key
      );

      if (hasBrandKit) {
        logger.info('[videoGenerate] Brand kit found — running rich compose', { missionId, userId: targetUserId });
        const composeInput = await applyBrandKit(targetUserId, {
          jobId: missionId,
          tenantId,
          audioR2Key,
          visualR2Key: videoR2Key,
          subtitleSrt: subtitleSrt || undefined,
          generateThumbnail: true,
          normalizeAudio: true,
        });

        const result = await composeFinalVideo(composeInput);
        const finalUrl = base ? `${base}/${result.finalR2Key}` : result.finalR2Key;

        return {
          url: finalUrl,
          durationMs: (result.metadata?.durationSeconds ?? 0) * 1000,
        };
      }

      const result = await muxVideoAudio({
        videoUrl: videoPublicUrl,
        audioUrl: audioPublicUrl,
        outputKey: muxOutputKey,
      });

      logger.info('[videoGenerate] mux-audio-video complete', {
        missionId,
        finalUrl: result.url,
        durationMs: result.durationMs,
      });

      return result;
    });

    // Emit: compose complete (70%)
    await emitProgress(missionId, 'compose', 70, 'Ghép hoàn tất / Composition complete');

    // Checkpoint: mux-audio-video completed
    await writeStageCheckpoint(missionId, 'mux_audio_video', 'completed', tenantId, {
      render_report: {
        finalR2Key: muxOutputKey,
        finalUrl: muxed.url,
        durationMs: muxed.durationMs,
        muxedAt: new Date().toISOString(),
        brandKitApplied: false,
      },
      asset_manifest: {
        audioR2Key,
        videoR2Key,
        brandKitApplied: false,
        assets: [
          { type: 'audio', r2Key: audioR2Key, mimeType: 'audio/mpeg' },
          { type: 'video', r2Key: videoR2Key, mimeType: 'video/mp4' },
          { type: 'video', r2Key: muxOutputKey, mimeType: 'video/mp4' },
        ],
      },
    });

    // ── Step 7: Update engine_mission ─────────────────────────────────────
    await step.run('update-mission', async () => {
      const db = createServerClient();
      await db
        .from('engine_missions')
        .update({
          status: 'succeeded',
          result: JSON.stringify({
            output_video_url: muxed.url,
            audio_duration_sec: audioDurationSec,
          }),
          // Wave 12 H1: write dedicated columns (migration 0096) — not just JSON result
          output_video_url: muxed.url,
          // Audio is now embedded in the muxed mp4 — clear the separate audio column
          output_audio_url: null,
          video_job_id: wanJobId,
          completed_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        })
        .eq('id', missionId);

      logger.info('[videoGenerate] engine_mission updated to succeeded', { missionId });
    });

    // Checkpoint: update-mission completed
    await writeStageCheckpoint(missionId, 'update_mission', 'completed', tenantId, {
      render_report: {
        finalR2Key: muxOutputKey,
        finalUrl: muxed.url,
        durationMs: muxed.durationMs,
        muxedAt: new Date().toISOString(),
        brandKitApplied: false,
      },
    });

    // ── Step 7b: Insert videos row ────────────────────────────────────────
    // Propagates the FREE100 completed video to the `videos` table so user
    // gallery + distribute panel can find it. Wrapped in try-catch — a failure
    // here must NOT fail the mission; the video is already on R2.
    await step.run('insert-videos-row', async () => {
      try {
        const r2Host = process.env.R2_PUBLIC_HOSTNAME;
        const videoUrl = r2Host
          ? `https://${r2Host}/${muxOutputKey}`
          : muxed.url;

        const { videoId, alreadyExisted } = await insertAiPromptVideo({
          userId: userId ?? tenantId,
          missionId,
          r2Key: muxOutputKey,
          videoUrl,
        });

        if (alreadyExisted) {
          logger.info('[videoGenerate] videos row already existed (Inngest retry — expected)', {
            videoId,
            missionId,
          });
        } else {
          logger.info('[videoGenerate] videos row inserted', { videoId, missionId, r2Key: muxOutputKey });
        }
        return { videoId };
      } catch (err) {
        // Non-fatal: log and continue. Mission is already succeeded.
        logger.error(
          '[videoGenerate] insert-videos-row failed (non-fatal)',
          err instanceof Error ? err : new Error(String(err)),
          { missionId },
        );
        return { videoId: null };
      }
    });

    // Emit: publish ready (80%)
    await emitProgress(missionId, 'publish', 80, 'Sẵn sàng xuất bản / Ready for publishing');

    // Checkpoint: emit-usage completed (pipeline complete)
    await writeStageCheckpoint(missionId, 'emit_usage', 'completed', tenantId, {
      render_report: {
        finalR2Key: muxOutputKey,
        finalUrl: muxed.url,
        durationMs: muxed.durationMs,
        muxedAt: new Date().toISOString(),
        brandKitApplied: false,
      },
    });

    // ── Step 8: Emit Usage ────────────────────────────────────────────────
    await step.run('emit-usage', async () => {
      await recordCost({
        jobId: missionId,
        stage: 'video-generate',
        provider: 'replicate+fal',
        units: 1,
        // Cost estimate: ~$0.05 Wan2.1 + ~$0.01 Fish Speech
        costUsd: 0.06,
      });
      logger.info('[videoGenerate] Usage cost recorded', { missionId, costUsd: 0.06 });
    });

    // Emit: complete (100%)
    await emitProgress(missionId, 'complete', 100, 'Video đã tạo xong / Video generation complete');

    return {
      missionId,
      tenantId,
      userId,
      audioR2Key,
      videoR2Key,
      finalVideoUrl: muxed.url,
      status: 'succeeded',
    };
  },
);
