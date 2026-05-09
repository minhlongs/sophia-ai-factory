/**
 * GET /api/v1/webhooks/[id]/attempts — list recent delivery attempts (tenant-scoped)
 * @module app/api/v1/webhooks/[id]/attempts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getById, listAttempts } from '@/lib/webhooks/registry';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

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

export async function GET(req: NextRequest, { params }: RouteParams) {
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const endpoint = await getById(db, id, user.id);
      if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const attempts = await listAttempts(db, id, 50);
      return NextResponse.json({ attempts });
    } catch (err) {
      logger.error('[Webhooks] List attempts failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(req);
}
