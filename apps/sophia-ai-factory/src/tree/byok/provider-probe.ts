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
} from '@/tree/byok/provider-health-checker';
import {
  PROBE_TARGETS,
  type ProbeResult,
  type ProbeTarget,
} from './provider-probe-endpoints';

export { PROBE_TARGETS, type ProbeResult, type ProbeTarget };

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
      if (provider === 'openrouter' && typeof res.json === 'function') {
        const payload = (await res.json().catch(() => null)) as {
          data?: { limit?: number | null; limit_remaining?: number | null };
        } | null;
        const limit = payload?.data?.limit;
        const remaining = payload?.data?.limit_remaining;
        if (
          typeof limit === 'number' &&
          Number.isFinite(limit) &&
          typeof remaining === 'number' &&
          Number.isFinite(remaining) &&
          remaining <= 0
        ) {
          return {
            ok: false,
            valid: false,
            provider,
            status: resolveProviderHealthStatus({
              hasKey: true,
              probeSuccess: false,
              httpStatus: 402,
            }),
            latencyMs,
            httpStatus: 402,
            message:
              'Your OpenRouter API key has $0 remaining credit limit. Please top up or raise the key limit on openrouter.ai.',
            message_vi:
              'Khóa API OpenRouter này đã hết hạn mức tín dụng (còn $0). Vui lòng nạp thêm hoặc tăng giới hạn khóa tại openrouter.ai.',
            maskedKey,
          };
        }
      }
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
    const isCreditExhausted = res.status === 402;
    const isQuotaFail = res.status === 429 || isCreditExhausted;
    return {
      ok: false,
      valid: false,
      provider,
      status,
      latencyMs,
      httpStatus: res.status,
      message: isAuthFail
        ? 'Invalid API key credentials'
        : isCreditExhausted
          ? 'Provider account or API key has insufficient credits (402)'
          : isQuotaFail
            ? `Provider quota or rate limit reached (${res.status})`
            : `Provider returned status ${res.status}`,
      message_vi: isAuthFail
        ? 'Khóa API không hợp lệ hoặc đã bị thu hồi'
        : isCreditExhausted
          ? 'Tài khoản hoặc khóa API đã hết tín dụng (credit) (402)'
          : isQuotaFail
            ? `Nhà cung cấp đã đạt giới hạn tần suất hoặc hết hạn mức (${res.status})`
            : `Nhà cung cấp trả về mã lỗi ${res.status}`,
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
