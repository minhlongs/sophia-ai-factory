/**
 * POST /api/v1/webhooks/[id]/test — fire a test event to the endpoint
 * @module app/api/v1/webhooks/[id]/test/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { globalRateLimiter, getClientIdentifier, createRateLimitResponse } from '@/forest/middleware/rate-limiter';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Cap test fires at 5/min per session — endpoint can be used as outbound
  // probe / DoS amplifier. SSRF protection lives in sender.ts (must block
  // private CIDR + 169.254.169.254). Defense-in-depth.
  const rl = globalRateLimiter.checkLimit(getClientIdentifier(req), { intervalMs: 60_000, maxRequests: 5 });
  if (!rl.allowed) return createRateLimitResponse(rl);

  const { id } = await params;
  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    // Import lazily to avoid circular issues at module level
    const { getById, recordAttempt } = await import('@/lib/webhooks/registry');
    const { sendWebhook } = await import('@/lib/webhooks/sender');

    const endpoint = await getById(db, id, user.id);
    if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Re-fetch with secret for signing
    const { getActiveEndpointsForEvent } = await import('@/lib/webhooks/registry');
    const endpointsWithSecret = await getActiveEndpointsForEvent(db, user.id, 'webhook.test');
    const epWithSecret = endpointsWithSecret.find(e => e.id === id);

    // If endpoint is inactive, still allow test but use getById row for URL
    const secret = epWithSecret?.secret;
    if (!secret) {
      // Endpoint might be inactive — fetch secret directly
      const row = await db
        .prepare(`SELECT secret FROM webhook_endpoints WHERE id = ?1 AND tenant_id = ?2`)
        .bind(id, user.id)
        .first<{ secret: string }>();
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const payload = {
        id: crypto.randomUUID(),
        event: 'webhook.test' as const,
        tenantId: user.id,
        timestamp: new Date().toISOString(),
        data: { message: 'Hello from Sophia', timestamp: new Date().toISOString() },
      };

      const result = await sendWebhook({ url: endpoint.url, secret: row.secret }, 'webhook.test', payload);
      await recordAttempt(db, {
        id: crypto.randomUUID(),
        endpointId: id,
        tenantId: user.id,
        event: 'webhook.test',
        payload: JSON.stringify(payload),
        attemptNum: 1,
        status: result.success ? 'success' : 'failed',
        httpStatus: result.httpStatus,
        responseBody: result.responseBody,
        errorMessage: result.error,
        completedAt: new Date().toISOString(),
      });
      return NextResponse.json({ result });
    }

    const payload = {
      id: crypto.randomUUID(),
      event: 'webhook.test' as const,
      tenantId: user.id,
      timestamp: new Date().toISOString(),
      data: { message: 'Hello from Sophia', timestamp: new Date().toISOString() },
    };

    const result = await sendWebhook({ url: endpoint.url, secret }, 'webhook.test', payload);
    await recordAttempt(db, {
      id: crypto.randomUUID(),
      endpointId: id,
      tenantId: user.id,
      event: 'webhook.test',
      payload: JSON.stringify(payload),
      attemptNum: 1,
      status: result.success ? 'success' : 'failed',
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      errorMessage: result.error,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({ result });
  } catch (err) {
    logger.error('[Webhooks] Test failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
