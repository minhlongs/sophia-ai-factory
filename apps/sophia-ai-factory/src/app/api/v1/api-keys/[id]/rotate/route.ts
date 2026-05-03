/**
 * POST /api/v1/api-keys/[id]/rotate — revoke old key + issue new one
 * @module app/api/v1/api-keys/[id]/rotate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { rotateApiKey, tierToRateLimit } from '@/forest/api-keys/d1-store';
import { logger } from '@/seed/utils/logger-utility';

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
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = RotateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const tier = await getUserTier(user.id);
    const rateLimit = tierToRateLimit(tier);
    const result = await rotateApiKey(db, id, user.id, parsed.data.name ?? 'Rotated Key', rateLimit);
    if (!result) return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    logger.error('[ApiKeys] Rotate failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
