/**
 * OmniRouter-Style Multi-Provider Video Router for Sophia Core.
 *
 * Eliminates single-provider deadlocks (e.g. HeyGen hanging or failing with 402/429/5xx)
 * by applying OmniRouter's 4 core resilience principles:
 * 1. Priority Failover Chain (`heygen` -> `did` -> `kling` -> `browser_h264_mp4` guaranteed fallback)
 * 2. Per-User Isolated Circuit Breakers (`byok:${userId}`)
 * 3. Classified Failure Handling (`AUTH_FAILURE`, `RATE_LIMIT`, `TIMEOUT`, `SERVER_ERROR`)
 * 4. Full Attempt Telemetry (`attempts[]` recorded honestly without swallowing errors)
 *
 * @module tree/video/providers/omni-video-router
 */

import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';

export type OmniVideoProviderId = 'heygen' | 'did' | 'kling' | 'browser_h264_mp4';

export interface OmniVideoRenderRequest {
  readonly userId: string;
  readonly title: string;
  readonly script: string;
  readonly aspectRatio: '9:16' | '16:9';
}

export interface OmniVideoProviderAdapter {
  readonly id: OmniVideoProviderId;
  readonly isConfigured: () => boolean;
  readonly submit: (
    req: OmniVideoRenderRequest,
  ) => Promise<{ readonly jobId: string; readonly mode: 'async_provider' | 'client_fallback' }>;
}

export interface OmniVideoAttempt {
  readonly provider: OmniVideoProviderId;
  readonly outcome: 'succeeded' | 'skipped_unconfigured' | 'skipped_breaker_open' | 'failed';
  readonly failureKind?: FailureKind;
  readonly errorMessage?: string;
}

export interface OmniVideoRouteResult {
  readonly selectedProvider: OmniVideoProviderId;
  readonly jobId: string;
  readonly mode: 'async_provider' | 'client_fallback';
  readonly failoverOccurred: boolean;
  readonly attempts: readonly OmniVideoAttempt[];
}

export const DEFAULT_VIDEO_PROVIDER_ORDER: readonly OmniVideoProviderId[] = [
  'heygen',
  'did',
  'kling',
  'browser_h264_mp4',
];

export async function routeVideoRenderWithFailover(
  req: OmniVideoRenderRequest,
  adapters: readonly OmniVideoProviderAdapter[],
): Promise<OmniVideoRouteResult> {
  const breakerScope = `byok:${req.userId}`;
  const attempts: OmniVideoAttempt[] = [];
  let hadProviderFailure = false;

  for (const adapter of adapters) {
    if (!adapter.isConfigured()) {
      attempts.push({ provider: adapter.id, outcome: 'skipped_unconfigured' });
      continue;
    }

    if (adapter.id !== 'browser_h264_mp4' && !shouldAllowRequest(adapter.id, breakerScope)) {
      hadProviderFailure = true;
      attempts.push({
        provider: adapter.id,
        outcome: 'skipped_breaker_open',
        errorMessage: `Circuit breaker open for ${adapter.id}`,
      });
      continue;
    }

    try {
      const res = await adapter.submit(req);
      if (adapter.id !== 'browser_h264_mp4') {
        recordSuccess(adapter.id, breakerScope);
      }
      attempts.push({ provider: adapter.id, outcome: 'succeeded' });
      return {
        selectedProvider: adapter.id,
        jobId: res.jobId,
        mode: res.mode,
        failoverOccurred: hadProviderFailure,
        attempts,
      };
    } catch (err) {
      hadProviderFailure = true;
      const failureKind = classifyError(err);
      if (adapter.id !== 'browser_h264_mp4') {
        recordFailure(adapter.id, failureKind, breakerScope);
      }
      attempts.push({
        provider: adapter.id,
        outcome: 'failed',
        failureKind,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    selectedProvider: 'browser_h264_mp4',
    jobId: `browser-fallback-${Date.now()}`,
    mode: 'client_fallback',
    failoverOccurred: true,
    attempts,
  };
}
