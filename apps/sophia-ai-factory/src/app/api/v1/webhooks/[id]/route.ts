/**
 * GET    /api/v1/webhooks/[id] — get endpoint detail (no secret)
 * PATCH  /api/v1/webhooks/[id] — update active/events/description
 * DELETE /api/v1/webhooks/[id] — delete endpoint
 * @module app/api/v1/webhooks/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getById, update, remove } from '@/land/webhooks/registry';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import type { WebhookEvent } from '@/land/webhooks/types';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  active: z.boolean().optional(),
  events: z.array(z.enum([
    'mission.completed',
    'video.ready',
    'payment.received',
    'error.threshold',
    'affiliate.discovered',
  ] as const)).min(1).optional(),
  description: z.string().max(256).optional(),
});

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
    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const endpoint = await getById(db, id, user.id);
      if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ endpoint });
    } catch (err) {
      logger.error('[Webhooks] Get failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(req);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await r.json().catch(() => null);
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const endpoint = await update(db, id, user.id, {
        ...parsed.data,
        events: parsed.data.events as WebhookEvent[] | undefined,
      });
      if (!endpoint) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ endpoint });
    } catch (err) {
      logger.error('[Webhooks] Update failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return withRateLimit(async (r: NextRequest) => {
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const deleted = await remove(db, id, user.id);
      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      logger.error('[Webhooks] Delete failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}
