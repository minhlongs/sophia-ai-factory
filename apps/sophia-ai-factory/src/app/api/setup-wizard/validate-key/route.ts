/**
 * POST /api/setup-wizard/validate-key
 * Real provider health check probe for Setup Wizard BYOK credentials.
 * Calls upstream lightweight endpoints with a strict 5s timeout. Fail-closed. Zero key logging.
 *
 * @module app/api/setup-wizard/validate-key/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  maskApiKey,
  resolveProviderHealthStatus,
  type ProviderHealthStatus,
} from '@/tree/byok/provider-health-checker';

export const dynamic = 'force-dynamic';
const PING_TIMEOUT_MS = 5_000;

const Schema = z.object({
  provider: z.string().min(1, 'provider is required'),
  api_key: z.string().min(1, 'api_key is required'),
});

interface ProbeTarget {
  url: string;
  method: 'GET' | 'POST';
  headers: (k: string) => Record<string, string>;
}

const PROBE_TARGETS: Record<string, ProbeTarget> = {
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, valid: false, message: 'Unauthorized', message_vi: 'Chưa đăng nhập' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, valid: false, message: 'Invalid JSON', message_vi: 'Dữ liệu JSON không hợp lệ' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: parsed.error.issues[0]?.message ?? 'Validation error',
      message_vi: 'Lỗi xác thực thông tin đầu vào',
    }, { status: 400 });
  }

  const { provider, api_key } = parsed.data;
  const target = PROBE_TARGETS[provider];
  const maskedKey = maskApiKey(api_key);
  const start = Date.now();

  if (!target) {
    return NextResponse.json({
      ok: false,
      valid: false,
      provider,
      status: 'UNKNOWN' as ProviderHealthStatus,
      message: `Unsupported provider: ${provider}`,
      message_vi: `Nhà cung cấp chưa được hỗ trợ: ${provider}`,
      maskedKey,
    }, { status: 400 });
  }

  try {
    const res = await fetch(target.url, {
      method: target.method,
      headers: target.headers(api_key),
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - start;
    const isProbeOk = res.ok;
    const status = resolveProviderHealthStatus({ hasKey: true, probeSuccess: isProbeOk, httpStatus: res.status });

    if (isProbeOk) {
      return NextResponse.json({
        ok: true,
        valid: true,
        provider,
        status,
        latencyMs,
        message: 'Connection successful and key is active',
        message_vi: 'Kết nối thành công và khóa đang hoạt động',
        maskedKey,
      });
    }

    const isAuthFail = res.status === 401 || res.status === 403;
    return NextResponse.json({
      ok: false,
      valid: false,
      provider,
      status,
      latencyMs,
      message: isAuthFail ? 'Invalid API key credentials' : `Provider returned status ${res.status}`,
      message_vi: isAuthFail ? 'Khóa API không hợp lệ hoặc đã hết hạn' : `Nhà cung cấp trả về mã lỗi ${res.status}`,
      maskedKey,
    }, { status: isAuthFail ? 422 : 502 });
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || msg.includes('abort') || msg.includes('TimeoutError');

    logger.warn('[setup-wizard/validate-key] Probe network error', { provider, isTimeout, latencyMs });
    const status = resolveProviderHealthStatus({ hasKey: true, isTimeout, probeSuccess: false, httpStatus: isTimeout ? 504 : 502 });

    return NextResponse.json({
      ok: false,
      valid: false,
      provider,
      status,
      latencyMs,
      message: isTimeout ? 'Provider connection timed out (5s)' : 'Provider connection failed',
      message_vi: isTimeout ? 'Kết nối tới nhà cung cấp hết thời gian (5s)' : 'Lỗi kết nối tới nhà cung cấp',
      maskedKey,
    }, { status: 502 });
  }
}
