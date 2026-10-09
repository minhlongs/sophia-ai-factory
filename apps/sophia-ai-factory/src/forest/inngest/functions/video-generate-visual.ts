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
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
// eslint-disable-next-line no-restricted-imports -- forest→land orchestration: video generation service clients
import { getHeyGenClient } from '@/land/heygen/heygen-client';
import { createDidTalk } from '@/forest/did/did-client';
import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from './video-generate-helpers';

// ── Types ─────────────────────────────────────────────────────────────────

export interface VisualProviderResult {
  videoUrl: string | null;
  provider: string;
  /** The job/prediction ID assigned by the provider (only set for Wan 2.1). */
  wanJobId?: string;
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

  try {
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
  } catch (err) {
    logger.warn('[videoGenerate] HeyGen creation or polling error', { error: err });
  }

  return { videoUrl: null, provider: 'heygen' };
}

// ── D-ID ──────────────────────────────────────────────────────────────────

export async function pollDidVideo(
  userId: string,
  prompt: string,
  sleep: SleepFn,
): Promise<VisualProviderResult> {
  if (!shouldAllowRequest('did')) {
    logger.warn('[videoGenerate] Circuit breaker open for D-ID');
    return { videoUrl: null, provider: 'd-id' };
  }

  const didKey = await getUserApiKey(userId, 'd-id');
  if (!didKey) return { videoUrl: null, provider: 'd-id' };

  let talkId: string;
  try {
    const talk = await createDidTalk(didKey, {
      sourceUrl: 'https://studio.d-id.com/agents/default-avatar.png',
      script: prompt,
    });
    talkId = talk.id;
  } catch (err) {
    logger.warn('[videoGenerate] D-ID talk initialization failed', { error: err });
    return { videoUrl: null, provider: 'd-id' };
  }

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(`did-poll-${attempt}`, POLL_INTERVAL_MS);

    if (!shouldAllowRequest('did')) {
      logger.warn('[videoGenerate] D-ID circuit breaker open during poll loop');
      break;
    }

    try {
      const pollRes = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: { Authorization: `Basic ${didKey}` },
        signal: AbortSignal.timeout(30_000),
      });

      if (!pollRes.ok) {
        const kind = classifyHttpStatus(pollRes.status);
        recordFailure('did', kind);
        logger.warn('[videoGenerate] D-ID poll response not ok', { status: pollRes.status, kind });
        break;
      }

      recordSuccess('did');
      const pollData = (await pollRes.json()) as { status?: string; result_url?: string };
      if (pollData.status === 'done' && pollData.result_url) {
        return { videoUrl: pollData.result_url, provider: 'd-id' };
      }
      if (pollData.status === 'failed' || pollData.status === 'error') {
        logger.warn('[videoGenerate] D-ID talk failed', { talkId, status: pollData.status });
        break;
      }
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('did', kind);
      logger.warn('[videoGenerate] D-ID poll fetch error', { error: err, kind });
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
      return { videoUrl: status.videoUrl, provider: 'wan-video', wanJobId: jobId };
    }
    if (status.status === 'failed' || status.status === 'canceled') {
      throw new Error(`[videoGenerate] Wan job ${jobId} ended with status: ${status.status} — ${status.error ?? ''}`);
    }
  }

  throw new Error(`[videoGenerate] Wan job ${jobId} did not complete after ${POLL_MAX_ATTEMPTS} polls`);
}
