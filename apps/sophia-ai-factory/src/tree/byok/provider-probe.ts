/**
 * Provider Health Probe — Live upstream connection & authentication validator.
 *
 * Calls upstream lightweight provider endpoints with a strict 5s timeout.
 * Never logs raw key bytes; masks key to `****...${last4}`.
 *
 * @module tree/byok/provider-probe
 */

import { logger } from '@/seed/utils/logger-utility';
import { sanitizeCredential } from '@/tree/byok/key-format-validators';
import {
  maskApiKey,
  resolveProviderHealthStatus,
} from '@/tree/byok/provider-health-checker';
import {
  PROBE_TARGETS,
  isMaskedOrPlaceholderCredential,
  type ProbeResult,
  type ProbeTarget,
  type ProviderProbeErrorCode,
} from './provider-probe-endpoints';

export {
  PROBE_TARGETS,
  isMaskedOrPlaceholderCredential,
  type ProbeResult,
  type ProbeTarget,
  type ProviderProbeErrorCode,
};

function createCorrelationId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `probe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapFailureStatus(httpStatus: number): {
  errorCode: ProviderProbeErrorCode;
  message: string;
  message_vi: string;
} {
  if (httpStatus === 401) {
    return {
      errorCode: 'INVALID_CREDENTIAL',
      message: 'Invalid API key credentials',
      message_vi: 'Khóa API không hợp lệ hoặc đã bị thu hồi.',
    };
  }
  if (httpStatus === 403) {
    return {
      errorCode: 'FORBIDDEN',
      message: 'API key lacks required permissions or access is forbidden',
      message_vi: 'Khóa API không đủ quyền truy cập hoặc bị từ chối (403).',
    };
  }
  if (httpStatus === 429) {
    return {
      errorCode: 'RATE_LIMITED',
      message: 'Provider rate limit exceeded. Please try again later.',
      message_vi: 'Nhà cung cấp đang giới hạn yêu cầu. Vui lòng thử lại sau.',
    };
  }
  return {
    errorCode: 'PROVIDER_UNAVAILABLE',
    message: `Provider returned status ${httpStatus}`,
    message_vi: `Nhà cung cấp trả về mã lỗi ${httpStatus}`,
  };
}

export async function probeProviderApiKey(
  provider: string,
  apiKey: string,
  timeoutMs = 5_000,
): Promise<ProbeResult> {
  const sanitizedKey = sanitizeCredential(apiKey);
  const target = PROBE_TARGETS[provider];
  const maskedKey = maskApiKey(sanitizedKey);
  const correlationId = createCorrelationId();
  const start = Date.now();

  if (isMaskedOrPlaceholderCredential(sanitizedKey)) {
    return {
      ok: false, valid: false, provider, status: 'INVALID',
      errorCode: 'VALIDATION_ERROR', verifiedAt: null, durationMs: 0, latencyMs: 0,
      correlationId, httpStatus: 400,
      message: 'API key is empty or contains a masked placeholder',
      message_vi: 'Khóa API trống hoặc đang chứa ký tự ẩn (****). Vui lòng nhập khóa thực.',
      maskedKey,
    };
  }

  if (!target) {
    return {
      ok: false, valid: false, provider, status: 'UNKNOWN',
      errorCode: 'CONFIGURATION_ERROR', verifiedAt: null, durationMs: 0, latencyMs: 0,
      correlationId, httpStatus: 400,
      message: `Unsupported provider for live probe: ${provider}`,
      message_vi: `Dịch vụ xác thực đang gặp lỗi cấu hình (${provider}).`,
      maskedKey,
    };
  }

  try {
    const res = await fetch(target.url, {
      method: target.method,
      headers: target.headers(sanitizedKey),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - start;

    if (res.ok && typeof res.json === 'function') {
      try {
        const payload: unknown = await res.json();
        if (!payload || typeof payload !== 'object') throw new Error('Non-object JSON');
      } catch {
        return {
          ok: false, valid: false, provider, status: 'PROVIDER_UNAVAILABLE',
          errorCode: 'PROVIDER_RESPONSE_ERROR', verifiedAt: null,
          durationMs: latencyMs, latencyMs, correlationId, httpStatus: 502,
          message: 'Provider returned an unreadable response payload',
          message_vi: 'Phản hồi từ nhà cung cấp không đúng định dạng JSON.',
          maskedKey,
        };
      }
    }

    const status = resolveProviderHealthStatus({
      hasKey: true, probeSuccess: res.ok, httpStatus: res.status,
    });

    if (res.ok) {
      return {
        ok: true, valid: true, provider, status, errorCode: null,
        verifiedAt: new Date().toISOString(), durationMs: latencyMs, latencyMs,
        correlationId, httpStatus: res.status,
        message: 'Connection successful and key is active',
        message_vi: 'Đã xác thực thành công.',
        maskedKey,
      };
    }

    const mapped = mapFailureStatus(res.status);
    return {
      ok: false, valid: false, provider, status, errorCode: mapped.errorCode,
      verifiedAt: null, durationMs: latencyMs, latencyMs, correlationId,
      httpStatus: res.status, message: mapped.message, message_vi: mapped.message_vi, maskedKey,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';
    const isTimeout = name === 'AbortError' || name === 'TimeoutError' || /timeout|abort/i.test(msg);

    logger.warn('[provider-probe] Upstream probe failed', {
      provider, isTimeout, latencyMs, correlationId,
    });

    const status = resolveProviderHealthStatus({
      hasKey: true, isTimeout, probeSuccess: false, httpStatus: isTimeout ? 504 : 502,
    });

    return {
      ok: false, valid: false, provider, status,
      errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      verifiedAt: null, durationMs: latencyMs, latencyMs, correlationId,
      httpStatus: isTimeout ? 504 : 502,
      message: isTimeout ? `Provider connection timed out (${timeoutMs / 1000}s)` : 'Provider connection failed',
      message_vi: isTimeout
        ? `Kết nối tới nhà cung cấp hết thời gian (${timeoutMs / 1000}s)`
        : 'Không thể kết nối tới nhà cung cấp. Chưa xác định được tính hợp lệ của khóa.',
      maskedKey,
    };
  }
}
