/**
 * GET + PATCH /api/v1/settings/storage — storage configuration.
 *
 * GET → return current storage settings for user (merged with defaults)
 * PATCH → update storage settings (validated via StorageSchema)
 *
 * @module app/api/v1/settings/storage/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getOrDefault, set, merge } from '@/seed/tenant-settings/registry';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import { SettingsValidationError } from '@/seed/tenant-settings/types';
import { DEFAULT_STORAGE } from '@/seed/tenant-settings/defaults';
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

export const GET = withRateLimit(async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const value = await getOrDefault(db, user.id, 'storage', DEFAULT_STORAGE);
    return NextResponse.json({ namespace: 'storage', value });
  } catch (err) {
    logger.error('[settings/storage] GET failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } });

export const PATCH = withRateLimit(async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'PATCH body must be a plain object' }, { status: 400 });
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const merged = await merge(
      db,
      user.id,
      'storage',
      body as Record<string, unknown>,
      (v) => validatorFor('storage')(v) as Record<string, unknown>,
    );
    return NextResponse.json({ namespace: 'storage', value: merged });
  } catch (err) {
    if (err instanceof SettingsValidationError) {
      return NextResponse.json(
        { error: 'Validation failed', message: err.message },
        { status: 422 },
      );
    }
    logger.error('[settings/storage] PATCH failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } });
