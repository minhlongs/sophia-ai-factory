/**
 * GET  /api/v1/api-keys — list user's active keys
 * POST /api/v1/api-keys — create a new key (returns full key ONCE)
 * @module app/api/v1/api-keys/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createApiKey, listApiKeys, tierToRateLimit } from '@/forest/api-keys/d1-store';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { errorResponse, handleThrownError } from '@/seed/api';

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

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const keys = await listApiKeys(db, user.id);
    return NextResponse.json({ keys });
  } catch (err) {
    return handleThrownError(err, 'Failed to list API keys', 'API_KEY_LIST_FAILED');
  }
}

// Cap key creation at 5/min per session to prevent hostile creation spam.
export const POST = withRateLimit(async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('Invalid request body', 'VALIDATION_ERROR', 400);
  }

  const db = await getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const tier = await resolveUserTier(user.id);
    const rateLimit = tierToRateLimit(tier);
    const result = await createApiKey(db, user.id, parsed.data.name, rateLimit, parsed.data.permissions);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleThrownError(err, 'Failed to create API key', 'API_KEY_CREATE_FAILED');
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 5 } });
