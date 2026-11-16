/**
 * POST /api/setup/verify
 *
 * Authenticated BYOK credential verification endpoint used by the Settings API Keys panel.
 * Protected by two-layer rate limiting (D1 `RATE_LIMITS.byok` at middleware + per-isolate
 * per-IP and per-user `globalRateLimiter` probing caps) and `probeProviderApiKey` so
 * customer `401`/`403` errors never trip the shared Worker circuit breaker.
 *
 * @module app/api/setup/verify/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { probeProviderApiKey } from '@/tree/byok/provider-probe';
import { sanitizeCredential } from '@/tree/byok/key-format-validators';
import {
  globalRateLimiter,
  getClientIpIdentifier,
  createRateLimitResponse,
} from '@/forest/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

const SUPPORTED_SERVICES = [
  'openrouter',
  'elevenlabs',
  'd-id',
  'heygen',
  'anthropic',
  'muapi',
  'fal-ai',
  'replicate',
] as const;

const SetupVerifySchema = z
  .object({
    service: z.string().trim().min(1),
    apiKey: z.string().optional(),
    key: z.string().optional(),
  })
  .transform((val) => ({
    service: val.service.toLowerCase(),
    resolvedKey: sanitizeCredential(val.apiKey ?? val.key ?? ''),
  }));

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const ipRl = globalRateLimiter.checkLimit(
    `setup:verify:${getClientIpIdentifier(request)}`,
    { intervalMs: 60_000, maxRequests: 12 },
  );
  if (!ipRl.allowed) return createRateLimitResponse(ipRl);

  const userRl = globalRateLimiter.checkLimit(`setup:verify:user:${user.id}`, {
    intervalMs: 60_000,
    maxRequests: 12,
  });
  if (!userRl.allowed) return createRateLimitResponse(userRl);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const parsed = SetupVerifySchema.safeParse(rawBody);
  if (!parsed.success || !parsed.data.resolvedKey) {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Missing service or apiKey' },
      { status: 400 },
    );
  }

  const { service, resolvedKey } = parsed.data;
  if (!(SUPPORTED_SERVICES as readonly string[]).includes(service)) {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Unknown service' },
      { status: 400 },
    );
  }

  const probe = await probeProviderApiKey(service, resolvedKey);
  return NextResponse.json({
    ok: probe.ok,
    valid: probe.valid,
    status: probe.status,
    provider: probe.provider,
    maskedKey: probe.maskedKey,
    latencyMs: probe.latencyMs,
    message: probe.message,
    message_vi: probe.message_vi,
  });
}
