/**
 * DELETE /api/v1/integrations/channels/[provider] — revoke/disconnect channel
 * @module app/api/v1/integrations/channels/[provider]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { OAUTH_CHANNEL_PROVIDERS } from '@/seed/config/channels/supported-providers';

export const dynamic = 'force-dynamic';

const ALLOWED_PROVIDERS = new Set<string>([...OAUTH_CHANNEL_PROVIDERS]);

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch { return null; }
}

type Params = { params: Promise<{ provider: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { provider } = await params;
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ALLOWED_PROVIDERS.has(provider))
      return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });

    const db = getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      await db
        .prepare(
          `UPDATE publishing_channels SET status = 'disconnected', updated_at = ?
           WHERE user_id = ? AND provider = ?`,
        )
        .bind(Math.floor(Date.now() / 1000), user.id, provider)
        .run();

      return NextResponse.json({ success: true });
    } catch (err) {
      logger.error('[channels] DELETE failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}
