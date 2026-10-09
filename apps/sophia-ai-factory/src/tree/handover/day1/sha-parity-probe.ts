/**
 * Checkpoint 2: Production Commit SHA Parity Gate.
 * Layer: tree (Domain operations; imports only from @/seed)
 *
 * @module tree/handover/day1/sha-parity-probe
 */

import type { CheckpointResult, CheckpointStatus } from '@/seed/handover/handover-types';
import type { Day1ProbeOptions } from './types';

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
    let liveSha = '';
    let networkReachable = false;

    if (!options?.skipNetworkCalls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 3000);
        const res = await fetch(`${baseUrl}/api/version`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json = (await res.json()) as { shortSha?: string; commitSha?: string };
          liveSha = (json.shortSha || json.commitSha || '').trim();
          networkReachable = true;
        }
      } catch {
        // Network call timed out or failed
      }
    }

    const normLocal = rawLocalSha ? rawLocalSha.slice(0, 8) : '';
    const normLive = liveSha ? liveSha.slice(0, 8) : '';
    const latencyMs = Date.now() - start;

    const isDevOrPreview =
      process.env.NODE_ENV !== 'production' ||
      baseUrl.includes('localhost') ||
      baseUrl.includes('127.0.0.1') ||
      baseUrl.includes('preview');

    // Case 1: Live edge is reachable and local SHA is provided -> Genuine parity check
    if (networkReachable && normLive && normLocal) {
      if (normLive === normLocal) {
        return {
          checkpointId: 'sha_parity',
          name: 'Production Commit SHA Parity Gate',
          nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
          category: 'edge',
          status: 'PASS',
          latencyMs,
          details: `Parity confirmed: Live edge SHA (${normLive}) matches local commit (${normLocal})`,
          expected: normLocal,
          actual: normLive,
          diagnosticData: { localSha: rawLocalSha, liveSha, matched: true },
        };
      }

      // Parity check failed: local commit diverged from live edge deployment
      const status: CheckpointStatus = isDevOrPreview ? 'WARN' : 'FAIL';
      return {
        checkpointId: 'sha_parity',
        name: 'Production Commit SHA Parity Gate',
        nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
        category: 'edge',
        status,
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

    // Case 2: Live edge reachable, but local SHA is not set in runtime environment
    if (networkReachable && normLive) {
      const isKnown = normLive !== 'unknown';
      return {
        checkpointId: 'sha_parity',
        name: 'Production Commit SHA Parity Gate',
        nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
        category: 'edge',
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

    // Case 3: Network calls skipped or live edge unreachable, but local SHA is provided
    if (normLocal) {
      const status: CheckpointStatus = options?.skipNetworkCalls ? 'PASS' : (isDevOrPreview ? 'WARN' : 'FAIL');
      return {
        checkpointId: 'sha_parity',
        name: 'Production Commit SHA Parity Gate',
        nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
        category: 'edge',
        status,
        latencyMs,
        details: options?.skipNetworkCalls
          ? `Local commit SHA verified: ${normLocal} (network calls skipped)`
          : `Live edge unreachable at ${baseUrl}/api/version; local commit is ${normLocal}`,
        expected: normLocal,
        actual: options?.skipNetworkCalls ? normLocal : 'unreachable',
        diagnosticData: { localSha: rawLocalSha, liveSha: null, matched: !!options?.skipNetworkCalls },
      };
    }

    // Case 4: Neither local SHA nor live SHA could be resolved
    return {
      checkpointId: 'sha_parity',
      name: 'Production Commit SHA Parity Gate',
      nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
      category: 'edge',
      status: 'WARN',
      latencyMs,
      details: 'Neither local COMMIT_SHA nor live edge /api/version SHA is available',
      expected: '8-char commit SHA',
      actual: 'missing',
      diagnosticData: { localSha: null, liveSha: null, matched: false },
    };
  } catch (err) {
    return {
      checkpointId: 'sha_parity',
      name: 'Production Commit SHA Parity Gate',
      nameVi: 'Khớp Mã Git Commit Triển Khai Thực Tế',
      category: 'edge',
      status: 'WARN',
      latencyMs: Date.now() - start,
      details: `SHA Parity check warning: ${err instanceof Error ? err.message : String(err)}`,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
