/**
 * Checkpoint 2 Helpers: Production Commit SHA Parity Result Builders & Fetcher.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/sha-parity-helpers
 */

import type { CheckpointResult, CheckpointStatus } from '@/seed/handover/handover-types';
import type { Day1ProbeOptions } from './types';

export const CHECKPOINT_META = {
  checkpointId: 'sha_parity',
  name: 'Production Commit SHA Parity Gate',
  nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
  category: 'edge',
} as const;

export async function fetchLiveSha(
  baseUrl: string,
  options?: Day1ProbeOptions,
): Promise<{ liveSha: string; networkReachable: boolean }> {
  if (options?.skipNetworkCalls) {
    return { liveSha: '', networkReachable: false };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 3000);
    const res = await fetch(`${baseUrl}/api/version`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { liveSha: '', networkReachable: false };
    const json = (await res.json()) as { shortSha?: string; commitSha?: string };
    return {
      liveSha: (json.shortSha || json.commitSha || '').trim(),
      networkReachable: true,
    };
  } catch {
    return { liveSha: '', networkReachable: false };
  }
}

export function buildBothShasResult(
  rawLocalSha: string,
  liveSha: string,
  normLocal: string,
  normLive: string,
  latencyMs: number,
  isDevOrPreview: boolean,
): CheckpointResult {
  if (normLive === normLocal) {
    return {
      ...CHECKPOINT_META,
      status: 'PASS',
      latencyMs,
      details: `Parity confirmed: Live edge SHA (${normLive}) matches local commit (${normLocal})`,
      expected: normLocal,
      actual: normLive,
      diagnosticData: { localSha: rawLocalSha, liveSha, matched: true },
    };
  }
  return {
    ...CHECKPOINT_META,
    status: isDevOrPreview ? 'WARN' : 'FAIL',
    latencyMs,
    details: isDevOrPreview
      ? `SHA mismatch (dev/preview): expected local commit ${normLocal}, but live edge returned ${normLive}`
      : `Production commit SHA mismatch: local commit ${normLocal} !== live edge ${normLive}`,
    expected: normLocal,
    actual: normLive,
    diagnosticData: {
      localSha: rawLocalSha,
      liveSha,
      matched: false,
      environment: isDevOrPreview ? 'preview' : 'production',
    },
  };
}

export function buildLiveOnlyResult(
  rawLocalSha: string,
  liveSha: string,
  normLive: string,
  latencyMs: number,
): CheckpointResult {
  const isKnown = normLive !== 'unknown';
  return {
    ...CHECKPOINT_META,
    status: isKnown ? 'PASS' : 'WARN',
    latencyMs,
    details: isKnown
      ? `Live edge commit SHA verified: ${normLive} (local COMMIT_SHA not set in runtime env)`
      : 'Live edge returned "unknown" commit SHA (COMMIT_SHA was not injected during deployment)',
    expected: isKnown ? normLive : 'valid-sha',
    actual: normLive,
    diagnosticData: { localSha: rawLocalSha || null, liveSha, matched: isKnown },
  };
}

export function buildLocalOnlyResult(
  rawLocalSha: string,
  normLocal: string,
  latencyMs: number,
  isDevOrPreview: boolean,
  baseUrl: string,
  skipNetworkCalls: boolean,
): CheckpointResult {
  const status: CheckpointStatus = skipNetworkCalls ? 'PASS' : isDevOrPreview ? 'WARN' : 'FAIL';
  return {
    ...CHECKPOINT_META,
    status,
    latencyMs,
    details: skipNetworkCalls
      ? `Local commit SHA verified: ${normLocal} (network calls skipped)`
      : `Live edge unreachable at ${baseUrl}/api/version; local commit is ${normLocal}`,
    expected: normLocal,
    actual: skipNetworkCalls ? normLocal : 'unreachable',
    diagnosticData: { localSha: rawLocalSha, liveSha: null, matched: skipNetworkCalls },
  };
}
