/**
 * GET  /api/v1/webhooks — list all endpoints for current tenant
 * POST /api/v1/webhooks — create a new endpoint (secret shown ONCE)
 * @module app/api/v1/webhooks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { listByTenant, create } from '@/land/webhooks/registry';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import type { WebhookEvent } from '@/land/webhooks/types';

export const dynamic = 'force-dynamic';

const SUPPORTED_EVENTS: WebhookEvent[] = [
  'mission.completed',
  'video.ready',
  'payment.received',
  'error.threshold',
  'affiliate.discovered',
];

const CreateSchema = z.object({
  url: z.string().url().startsWith('https://'),
  events: z.array(z.enum([
    'mission.completed',
    'video.ready',
    'payment.received',
    'error.threshold',
    'affiliate.discovered',
  ] as const)).min(1),
  description: z.string().max(256).optional(),
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

export const GET = withRateLimit(async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const endpoints = await listByTenant(db, user.id);
    return NextResponse.json({ endpoints, supportedEvents: SUPPORTED_EVENTS });
  } catch (err) {
    logger.error('[Webhooks] List failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });

export const POST = withRateLimit(async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const endpoint = await create(db, {
      tenantId: user.id,
      url: parsed.data.url,
      events: parsed.data.events as WebhookEvent[],
      description: parsed.data.description,
    });
    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    const status = message.includes('Max ') ? 429 : message.includes('HTTPS') ? 400 : 500;
    logger.error('[Webhooks] Create failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: message }, { status });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 20 } });
