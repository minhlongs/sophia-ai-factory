/**
 * POST /api/v1/settings/reset — reset all settings for the current user.
 *
 * Deletes all rows from tenant_settings for the authenticated user's tenant.
 * Accepts empty body `{}` or `{ confirm: true }` for safety.
 *
 * @module app/api/v1/settings/reset/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { deleteAllForTenant } from '@/seed/tenant-settings/registry';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

export const POST = withRateLimit(async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);

  // CSRF protection: require X-Requested-With header
  const requestedWith = req.headers.get('X-Requested-With');
  if (requestedWith !== 'XMLHttpRequest') {
    return NextResponse.json({ error: 'Invalid request source' }, { status: 403 });
  }

  // Require explicit confirm flag for safety.
  if (!body || typeof body !== 'object' || !(body as Record<string, unknown>).confirm) {
    return NextResponse.json(
      { error: 'Confirmation required', message: 'Send { "confirm": true } to reset all settings' },
      { status: 400 },
    );
  }

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    await deleteAllForTenant(db, user.id);
    logger.info('[settings/reset] all settings deleted', { userId: user.id });
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('[settings/reset] POST failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 5 } });
