/**
 * GET /api/v1/integrations/channels — list OAuth channel connection status
 * @module app/api/v1/integrations/channels/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { SUPPORTED_PROVIDERS } from '@/seed/config/channels/supported-providers';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

interface ChannelRow {
  provider: string;
  display_name: string | null;
  status: string;
}

export const GET = withRateLimit(async function GET(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getCurrentUserFromHeaders>> | null = null;
  try {
    user = await getCurrentUserFromHeaders(req.headers);
  } catch (err) {
    logger.warn('[channels] auth lookup threw — treating as unauth', { err: err instanceof Error ? err.message : String(err) });
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const placeholders = SUPPORTED_PROVIDERS.map(() => '?').join(',');
    const { results } = await db
      .prepare(
        `SELECT provider, display_name, status
         FROM publishing_channels
         WHERE user_id = ? AND provider IN (${placeholders})
         GROUP BY provider`,
      )
      .bind(user.id, ...SUPPORTED_PROVIDERS)
      .all<ChannelRow>();

    const connectedMap = new Map((results ?? []).map(r => [r.provider, r]));
    const channels = SUPPORTED_PROVIDERS.map(p => {
      const row = connectedMap.get(p);
      return {
        provider: p,
        connected: !!row,
        display_name: row?.display_name ?? null,
        status: row?.status ?? null,
      };
    });

    return NextResponse.json({ channels });
  } catch (err) {
    logger.error('[channels] GET failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });
