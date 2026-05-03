/**
 * GET  /api/v1/api-keys — list user's active keys
 * POST /api/v1/api-keys — create a new key (returns full key ONCE)
 * @module app/api/v1/api-keys/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { createApiKey, listApiKeys, tierToRateLimit } from '@/lib/api-keys/d1-store';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

const CreateKeySchema = z.object({
  name: z.string().min(1).max(64),
  permissions: z.array(z.string()).optional().default([]),
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

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const keys = await listApiKeys(db, user.id);
    return NextResponse.json({ keys });
  } catch (err) {
    logger.error('[ApiKeys] List failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const tier = await getUserTier(user.id);
    const rateLimit = tierToRateLimit(tier);
    const result = await createApiKey(db, user.id, parsed.data.name, rateLimit, parsed.data.permissions);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    logger.error('[ApiKeys] Create failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
