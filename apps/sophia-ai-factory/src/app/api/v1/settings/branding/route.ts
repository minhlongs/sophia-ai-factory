/**
 * GET/PATCH /api/v1/settings/branding — Branding namespace shortcuts.
 *
 * GET   → return current branding (merged with defaults)
 * PATCH → shallow-merge partial update, validate via BrandingSchema
 *
 * This is a convenience alias; the generic /api/v1/settings/[namespace] also
 * handles branding, but this route provides typed validation + a stable URL
 * for the branding form client.
 *
 * @module app/api/v1/settings/branding/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getOrDefault, merge } from '@/lib/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/lib/tenant-settings/defaults';
import { BrandingSchema } from '@/lib/tenant-settings/namespace-validators';
import { SettingsValidationError } from '@/lib/tenant-settings/types';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
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
    const value = await getOrDefault(db, user.id, 'branding', DEFAULT_BRANDING);
    return NextResponse.json({ namespace: 'branding', value });
  } catch (err) {
    logger.error('[settings/branding] GET failed', err instanceof Error ? err : undefined);
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
      'branding',
      body as Record<string, unknown>,
      (v) => BrandingSchema.parse(v),
    );
    return NextResponse.json({ namespace: 'branding', value: merged });
  } catch (err) {
    if (err instanceof SettingsValidationError) {
      return NextResponse.json({ error: 'Validation failed', message: err.message }, { status: 422 });
    }
    logger.error('[settings/branding] PATCH failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } });
