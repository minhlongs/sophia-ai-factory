/**
 * Checkpoint 2: Production Commit SHA Parity Gate.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/sha-parity-probe
 */

import type { CheckpointResult } from '@/seed/handover/handover-types';
import type { Day1ProbeOptions } from './types';
import {
  CHECKPOINT_META,
  fetchLiveSha,
  buildBothShasResult,
  buildLiveOnlyResult,
  buildLocalOnlyResult,
} from './sha-parity-helpers';

export {
  CHECKPOINT_META,
  fetchLiveSha,
  buildBothShasResult,
  buildLiveOnlyResult,
  buildLocalOnlyResult,
};

/**
 * 2. Checkpoint: Production Commit SHA Parity Gate
 *
 * Compares the local repository/runtime commit SHA against the live edge deployment
 * returned by /api/version. Detects deployment drift and version skew.
 */
export async function probeShaParity(options?: Day1ProbeOptions): Promise<CheckpointResult> {
  const start = Date.now();
  const rawLocalSha = (process.env.COMMIT_SHA || process.env.NEXT_PUBLIC_COMMIT_SHA || '').trim();
  const baseUrl = options?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  try {
    const { liveSha, networkReachable } = await fetchLiveSha(baseUrl, options);
    const normLocal = rawLocalSha ? rawLocalSha.slice(0, 8) : '';
    const normLive = liveSha ? liveSha.slice(0, 8) : '';
    const latencyMs = Date.now() - start;
    const isDevOrPreview =
      process.env.NODE_ENV !== 'production' ||
      baseUrl.includes('localhost') ||
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('preview');

    if (networkReachable && normLive && normLocal) {
      return buildBothShasResult(rawLocalSha, liveSha, normLocal, normLive, latencyMs, isDevOrPreview);
    }
    if (networkReachable && normLive) {
      return buildLiveOnlyResult(rawLocalSha, liveSha, normLive, latencyMs);
    }
    if (normLocal) {
      return buildLocalOnlyResult(
        rawLocalSha,
        normLocal,
        latencyMs,
        isDevOrPreview,
        baseUrl,
        Boolean(options?.skipNetworkCalls),
      );
    }

    return {
      ...CHECKPOINT_META,
      status: 'WARN',
      latencyMs,
      details: 'Neither local COMMIT_SHA nor live edge /api/version SHA is available',
      expected: '8-char commit SHA',
      actual: 'missing',
      diagnosticData: { localSha: null, liveSha: null, matched: false },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ...CHECKPOINT_META,
      status: 'WARN',
      latencyMs: Date.now() - start,
      details: `SHA Parity check warning: ${msg}`,
      error: msg,
    };
  }
}
