/**
 * Provider Health Probe — Live upstream connection & authentication validator.
 *
 * Calls upstream lightweight provider endpoints with a strict 5s timeout.
 * Never logs raw key bytes; masks key to `****...${last4}`.
 *
 * @module tree/byok/provider-probe
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  maskApiKey,
  resolveProviderHealthStatus,
  type ProviderHealthStatus,
} from '@/tree/byok/provider-health-checker';

export interface ProbeTarget {
  url: string;
  method: 'GET' | 'POST';
  headers: (k: string) => Record<string, string>;
}

export const PROBE_TARGETS: Record<string, ProbeTarget> = {
  'fal-ai': {
    url: 'https://queue.fal.run/',
    method: 'GET',
    headers: (k) => ({ Authorization: `Key ${k}` }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/auth/key',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  elevenlabs: {
    url: 'https://api.elevenlabs.io/v1/user',
    method: 'GET',
    headers: (k) => ({ 'xi-api-key': k }),
  },
  'd-id': {
    url: 'https://api.d-id.com/credits',
    method: 'GET',
    headers: (k) => ({
      Authorization: `Basic ${k.includes(':') ? Buffer.from(k, 'utf-8').toString('base64') : k.replace(/^Basic\s+/i, '')}`,
    }),
  },
  heygen: {
    url: 'https://api.heygen.com/v2/voices?limit=1',
    method: 'GET',
    headers: (k) => ({ 'X-Api-Key': k, accept: 'application/json' }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    method: 'GET',
    headers: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
  },
  muapi: {
    url: 'https://api.muapi.ai/v1/account',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  replicate: {
    url: 'https://api.replicate.com/v1/account',
    method: 'GET',
    headers: (k) => ({ Authorization: `Bearer ${k}` }),
  },
};

export interface ProbeResult {
  ok: boolean;
  valid: boolean;
  provider: string;
  status: ProviderHealthStatus;
  latencyMs: number;
  message: string;
  message_vi: string;
  maskedKey: string;
  httpStatus?: number;
}

/**
 * Perform a real-time live ping probe against the upstream provider.
 *
 * @param provider - Provider identifier (e.g. 'openrouter', 'elevenlabs')
 * @param apiKey - Plaintext API key to probe
 * @param timeoutMs - Maximum probe timeout in milliseconds (default: 5000)
 */
export async function probeProviderApiKey(
  provider: string,
  apiKey: string,
  timeoutMs = 5_000,
): Promise<ProbeResult> {
  const target = PROBE_TARGETS[provider];
  const maskedKey = maskApiKey(apiKey);
  const start = Date.now();

  if (!target) {
    return {
      ok: false,
      valid: false,
      provider,
      status: 'UNKNOWN',
      latencyMs: 0,
      httpStatus: 400,
      message: `Unsupported provider for live probe: ${provider}`,
      message_vi: `Nhà cung cấp chưa được hỗ trợ kiểm tra trực tiếp: ${provider}`,
      maskedKey,
    };
  }

  try {
    const res = await fetch(target.url, {
      method: target.method,
      headers: target.headers(apiKey),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Date.now() - start;
    const isProbeOk = res.ok;
    const status = resolveProviderHealthStatus({
      hasKey: true,
      probeSuccess: isProbeOk,
      httpStatus: res.status,
    });

    if (isProbeOk) {
      return {
        ok: true,
        valid: true,
        provider,
        status,
        latencyMs,
        httpStatus: res.status,
        message: 'Connection successful and key is active',
        message_vi: 'Kết nối thành công và khóa đang hoạt động',
        maskedKey,
      };
    }

    const isAuthFail = res.status === 401 || res.status === 403;
    return {
      ok: false,
      valid: false,
      provider,
      status,
      latencyMs,
      httpStatus: res.status,
      message: isAuthFail ? 'Invalid API key credentials' : `Provider returned status ${res.status}`,
      message_vi: isAuthFail ? 'Khóa API không hợp lệ hoặc đã hết hạn' : `Nhà cung cấp trả về mã lỗi ${res.status}`,
      maskedKey,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('TimeoutError');

    logger.warn('[provider-probe] Upstream probe failed', {
      provider,
      isTimeout,
      latencyMs,
    });

    const status = resolveProviderHealthStatus({
      hasKey: true,
      isTimeout,
      probeSuccess: false,
      httpStatus: isTimeout ? 504 : 502,
    });

    return {
      ok: false,
      valid: false,
      provider,
      status,
      latencyMs,
      httpStatus: isTimeout ? 504 : 502,
      message: isTimeout ? `Provider connection timed out (${timeoutMs / 1000}s)` : 'Provider connection failed',
      message_vi: isTimeout ? `Kết nối tới nhà cung cấp hết thời gian (${timeoutMs / 1000}s)` : 'Lỗi kết nối tới nhà cung cấp',
      maskedKey,
    };
  }
}
