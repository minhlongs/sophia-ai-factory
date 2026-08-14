/**
 * Visual generation providers for the video pipeline.
 *
 * Each provider initiates a job and polls until completion.
 * Sleep is injected via callback so the module stays framework-agnostic.
 *
 * @module forest/inngest/functions/video-generate-visual
 */

import { logger } from '@/seed/utils/logger-utility';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { getHeyGenClient } from '@/land/heygen/heygen-client';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { createDidTalk } from '@/land/did/did-client';
import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from './video-generate-helpers';

// ── Types ─────────────────────────────────────────────────────────────────

export interface VisualProviderResult {
  videoUrl: string | null;
  provider: string;
}

type SleepFn = (label: string, ms: number) => Promise<void>;

// ── HeyGen ────────────────────────────────────────────────────────────────

export async function pollHeyGenVideo(
  userId: string,
  prompt: string,
  missionId: string,
  sleep: SleepFn,
): Promise<VisualProviderResult> {
  const heygenClient = await getHeyGenClient(userId);
  if (!heygenClient) return { videoUrl: null, provider: 'heygen' };

  const videoId = await heygenClient.createVideo({
    avatarId: 'Daisy-inskirt-20220818',
    voiceId: 'en-US-JennyNeural',
    script: prompt,
    title: missionId,
  });

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(`heygen-poll-${attempt}`, POLL_INTERVAL_MS);
    const status = await heygenClient.getVideoStatus(videoId);
    if (status.status === 'completed' && status.video_url) {
      return { videoUrl: status.video_url, provider: 'heygen' };
    }
    if (status.status === 'failed') {
      logger.warn('[videoGenerate] HeyGen video failed', { videoId, error: status.error });
      break;
    }
  }

  return { videoUrl: null, provider: 'heygen' };
}

// ── D-ID ──────────────────────────────────────────────────────────────────

export async function pollDidVideo(
  userId: string,
  prompt: string,
  sleep: SleepFn,
): Promise<VisualProviderResult> {
  const didKey = await getUserApiKey(userId, 'd-id');
  if (!didKey) return { videoUrl: null, provider: 'd-id' };

  const talk = await createDidTalk(didKey, {
    sourceUrl: 'https://studio.d-id.com/agents/default-avatar.png',
    script: prompt,
  });

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(`did-poll-${attempt}`, POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://api.d-id.com/talks/${talk.id}`, {
      headers: { Authorization: `Basic ${didKey}` },
    });
    if (!pollRes.ok) break;

    const pollData = await pollRes.json() as { status?: string; result_url?: string };
    if (pollData.status === 'done' && pollData.result_url) {
      return { videoUrl: pollData.result_url, provider: 'd-id' };
    }
    if (pollData.status === 'failed' || pollData.status === 'error') {
      logger.warn('[videoGenerate] D-ID talk failed', { talkId: talk.id, status: pollData.status });
      break;
    }
  }

  return { videoUrl: null, provider: 'd-id' };
}

// ── Wan Video ─────────────────────────────────────────────────────────────

export async function pollWanVideo(
  prompt: string,
  sleep: SleepFn,
): Promise<VisualProviderResult> {
  const { getWanClient } = await import('./video-generate-helpers');
  const wanClient = getWanClient();
  const { jobId } = await wanClient.generateVideo({ prompt, duration: 5 });

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(`poll-wait-${attempt}`, POLL_INTERVAL_MS);
    const status = await wanClient.getJobStatus(jobId);

    if (status.status === 'succeeded' && status.videoUrl) {
      return { videoUrl: status.videoUrl, provider: 'wan-video' };
    }
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`[videoGenerate] Wan job ${jobId} ended with status: ${status.status} — ${status.error ?? ''}`);
    }
  }

  throw new Error(`[videoGenerate] Wan job ${jobId} did not complete after ${POLL_MAX_ATTEMPTS} polls`);
}
