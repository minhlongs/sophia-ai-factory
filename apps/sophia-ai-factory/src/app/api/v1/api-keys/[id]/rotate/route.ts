/**
 * POST /api/v1/api-keys/[id]/rotate — revoke old key + issue new one
 * @module app/api/v1/api-keys/[id]/rotate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { rotateApiKey, tierToRateLimit } from '@/forest/api-keys/d1-store';
import { globalRateLimiter, getClientIdentifier, createRateLimitResponse } from '@/forest/middleware/rate-limiter';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

const RotateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
});

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Cap rotate at 5/min per session (parallel with parent POST /api-keys cap).
    const rl = globalRateLimiter.checkLimit(getClientIdentifier(r), { intervalMs: 60_000, maxRequests: 5 });
    if (!rl.allowed) return createRateLimitResponse(rl);

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await r.json().catch(() => ({}));
    const parsed = RotateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const tier = await resolveUserTier(user.id);
      const rateLimit = tierToRateLimit(tier);
      const result = await rotateApiKey(db, id, user.id, parsed.data.name ?? 'Rotated Key', rateLimit);
      if (!result) return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      logger.error('[ApiKeys] Rotate failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 5 } })(req);
}
