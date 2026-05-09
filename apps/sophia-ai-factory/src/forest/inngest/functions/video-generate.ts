/**
 * Inngest Function: videoGenerate
 *
 * NOT REGISTERED in inngest/index.ts — defer to next wave.
 *
 * Event: 'video/generate.requested'
 * Steps:
 *   1. parse-input — extract prompt + voiceover text
 *   2. generate-tts — Fish Speech → upload audio to R2
 *   3. generate-video — Wan 2.1 submit job
 *   4. poll-video-ready — sleep+poll until succeeded/failed
 *   5. download-video — fetch video URL → upload to R2
 *   6. mux-audio-video — Cloudconvert REST API → muxed final.mp4 in R2
 *   7. update-mission — mark engine_mission completed with output URLs
 *   8. emit-usage — log MCU cost via recordCost
 *
 * Env vars required: WAN_API_KEY, FISH_SPEECH_API_KEY
 */

import { inngest } from '@/forest/inngest/client';
import { getD1Client } from '@/seed/db/client';
import { getVideoBucket } from '@/lib/video/r2-binding';
import { recordCost } from '@/lib/video/cost-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { WanVideoClient } from '@/lib/video/wan21-client';
import { FishSpeechClient } from '@/lib/video/fish-speech-client';
import { muxVideoAudio } from '@/lib/video/ffmpeg-muxer';
import type { VideoGenerateRequestedEvent } from '@/lib/video/types';

const POLL_INTERVAL_MS = 20_000; // 20s between polls
const POLL_MAX_ATTEMPTS = 18;    // 18 × 20s = 6 min max wait

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
  { id: 'video-generate', retries: 2 },
  { event: 'video/generate.requested' },
  async ({ event, step }) => {
    const data = event.data as VideoGenerateRequestedEvent;

    // ── Step 1: Parse Input ────────────────────────────────────────────────
    const { missionId, prompt, voiceoverText, tenantId, userId, language } =
      await step.run('parse-input', async () => {
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

    // ── Step 3: Submit Video Generation ───────────────────────────────────
    const { wanJobId } = await step.run('generate-video', async () => {
      const wanClient = getWanClient();
      const { jobId } = await wanClient.generateVideo({ prompt });
      logger.info('[videoGenerate] Wan 2.1 job submitted', { wanJobId: jobId });
      return { wanJobId: jobId };
    });

    // ── Step 4: Poll Until Video Ready ────────────────────────────────────
    let finalVideoUrl: string | undefined;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await step.sleep(`poll-wait-${attempt}`, POLL_INTERVAL_MS);

      const statusResult = await step.run(`poll-video-status-${attempt}`, async () => {
        const wanClient = getWanClient();
        return wanClient.getJobStatus(wanJobId);
      });

      if (statusResult.status === 'succeeded' && statusResult.videoUrl) {
        finalVideoUrl = statusResult.videoUrl;
        break;
      }
      if (statusResult.status === 'failed' || statusResult.status === 'canceled') {
        throw new Error(
          `[videoGenerate] Wan job ${wanJobId} ended with status: ${statusResult.status} — ${statusResult.error ?? ''}`,
        );
      }
    }

    if (!finalVideoUrl) {
      throw new Error(`[videoGenerate] Wan job ${wanJobId} did not complete after ${POLL_MAX_ATTEMPTS} polls`);
    }

    // ── Step 5: Download + Upload Video to R2 ────────────────────────────
    const videoR2Key = `video-jobs/${missionId}/video.mp4`;

    await step.run('download-video', async () => {
      const videoBuffer = await downloadToBuffer(finalVideoUrl!);
      await uploadBufferToR2(videoR2Key, videoBuffer, 'video/mp4');
      logger.info('[videoGenerate] Video uploaded to R2', { videoR2Key });
    });

    // ── Step 6: Mux Audio + Video via Cloudconvert ───────────────────────────
    // Build public URLs for the R2 objects so Cloudconvert can download them.
    // Falls back to R2 key strings when no public base URL is configured.
    const muxOutputKey = `video-jobs/${missionId}/final.mp4`;

    const muxed = await step.run('mux-audio-video', async () => {
      const ref = await getVideoBucket();
      const base = ref?.publicBaseUrl?.replace(/\/$/, '') ?? null;

      const videoPublicUrl = base ? `${base}/${videoR2Key}` : videoR2Key;
      const audioPublicUrl = base ? `${base}/${audioR2Key}` : audioR2Key;

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

    // ── Step 7: Update engine_mission ─────────────────────────────────────
    await step.run('update-mission', async () => {
      const db = await getD1Client();
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
