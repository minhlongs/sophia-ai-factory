/**
 * D-ID and Wan Video visual generation providers for the video pipeline.
 *
 * @module forest/inngest/functions/video-generate-visual-providers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import { createDidTalk } from '@/forest/did/did-client';
import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from './video-generate-helpers';

export interface VisualProviderResult {
  videoUrl: string | null;
  provider: string;
  /** The job/prediction ID assigned by the provider (only set for Wan 2.1). */
  wanJobId?: string;
}

export type SleepFn = (label: string, ms: number) => Promise<void>;

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
      throw new Error(
        `[videoGenerate] Wan job ${jobId} ended with status: ${status.status} — ${status.error ?? ''}`,
      );
    }
  }

  throw new Error(`[videoGenerate] Wan job ${jobId} did not complete after ${POLL_MAX_ATTEMPTS} polls`);
}
