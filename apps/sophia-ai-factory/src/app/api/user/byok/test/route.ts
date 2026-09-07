/**
 * POST /api/user/byok/test — connect-and-test for stored BYOK key.
 *
 * Pings the provider's lightweight /models or /user endpoint to verify the
 * key the user just stored actually works. Avoids the "first mission fails
 * 30 minutes later" UX problem where regex-only validation accepted a
 * malformed-but-shape-correct key.
 *
 * Body: { provider: 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'muapi' }
 * Response: { ok: boolean, status?: number, latencyMs?: number, error?: string }
 *
 * Auth: getCurrentUser. Cap 10/min to discourage probing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserApiKey, type ByokProvider } from '@/tree/byok/user-api-key-store';
import { logger } from '@/seed/utils/logger-utility';
import { globalRateLimiter, getClientIdentifier, createRateLimitResponse } from '@/forest/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

const Body = z.object({
  provider: z.enum(['openrouter', 'anthropic', 'elevenlabs', 'd-id', 'muapi', 'apollo', 'fal-ai']),
});

interface TestUrlSpec {
  url: string;
  authHeader: (key: string) => Record<string, string>;
}

// Hunter excluded: ?api_key= leaks via wrangler tail logs. Validate via mission call instead.
// Replicate excluded: validation happens on first createVideo call instead; no lightweight test endpoint.
type TestableProvider = Exclude<ByokProvider, 'heygen' | 'hunter' | 'replicate'>;

const TEST_ENDPOINT: Record<TestableProvider, TestUrlSpec> = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    authHeader: (k) => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01' }),
  },
  elevenlabs: {
    url: 'https://api.elevenlabs.io/v1/user',
    authHeader: (k) => ({ 'xi-api-key': k }),
  },
  'd-id': {
    url: 'https://api.d-id.com/credits',
    authHeader: (k) => ({ Authorization: `Basic ${k}` }),
  },
  muapi: {
    url: 'https://api.muapi.ai/v1/account',
    authHeader: (k) => ({ Authorization: `Bearer ${k}` }),
  },
  apollo: {
    url: 'https://api.apollo.io/api/v1/auth/health',
    authHeader: (k) => ({ 'X-Api-Key': k }),
  },
  'fal-ai': {
    url: 'https://queue.fal.run/',
    authHeader: (k) => ({ Authorization: `Key ${k}` }),
  },
  // Hunter intentionally omitted: their endpoints require api_key as a query-string
  // param which would leak the key into Cloudflare's outbound-fetch logs visible via
  // `wrangler tail`. Validation happens on first /lead:enrich call instead.
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = globalRateLimiter.checkLimit(getClientIdentifier(request), { intervalMs: 60_000, maxRequests: 10 });
  if (!rl.allowed) return createRateLimitResponse(rl);

  const body = await request.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const provider = parsed.data.provider;
  const stored = await getUserApiKey(user.id, provider).catch(() => null);
  if (!stored) {
    return NextResponse.json({ ok: false, error: 'No key stored for this provider' }, { status: 404 });
  }

  const spec = TEST_ENDPOINT[provider];
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(spec.url, {
      method: 'GET',
      headers: spec.authHeader(stored),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - t0;
    if (res.ok) {
      return NextResponse.json({ ok: true, status: res.status, latencyMs });
    }
    return NextResponse.json({
      ok: false,
      status: res.status,
      latencyMs,
      error: `Provider returned HTTP ${res.status}`,
    });
  } catch (err) {
    logger.warn('[byok/test] Provider call failed', { provider, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    });
  }
}
