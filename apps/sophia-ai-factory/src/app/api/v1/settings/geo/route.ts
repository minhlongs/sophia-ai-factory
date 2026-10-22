/**
 * GET + PUT /api/v1/settings/geo — tenant audience-jurisdiction declaration.
 *
 * The compliance gate blocks regulated verticals (crypto, trading) when the
 * tenant's target jurisdiction is unknown, so a tenant that publishes such
 * content needs a way to declare it. This route is that write path.
 *
 * PUT replaces the declared jurisdiction while preserving the tenant's block
 * rules; GET returns the merged current value. Both are tenant-scoped through
 * the authenticated session — a tenant can only ever declare for itself.
 *
 * @module app/api/v1/settings/geo/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getOrDefault, set } from '@/seed/tenant-settings/registry';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import { SettingsValidationError } from '@/seed/tenant-settings/types';
import { DEFAULT_GEO } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { mergeJurisdiction } from './geo-route-helpers';

export const dynamic = 'force-dynamic';

const READ_LIMIT = { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } };
const WRITE_LIMIT = { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } };

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

/**
 * Request contract. `targetJurisdiction` must be a 2-letter ISO country code or
 * `EU`; null clears the declaration. Uppercasing is the only transformation
 * applied — the value is never inferred or defaulted, and anything that is not
 * a recognised code shape is rejected here rather than by the namespace schema
 * so the caller gets a field-specific error.
 */
const JURISDICTION_MESSAGE = 'Must be a 2-letter ISO country code, e.g. US, VN, EU';

const JurisdictionSchema = z.union([
  z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => /^([A-Z]{2}|EU)$/.test(v), { message: JURISDICTION_MESSAGE }),
  z.null(),
]);

const GeoPutSchema = z.object({
  targetJurisdiction: JurisdictionSchema,
});

export const GET = withRateLimit(
  async function GET(req: NextRequest): Promise<NextResponse> {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const value = await getOrDefault(db, user.id, 'geo', DEFAULT_GEO);
      return NextResponse.json({ namespace: 'geo', value });
    } catch (err) {
      logger.error('[settings/geo] GET failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  },
  READ_LIMIT,
);

export const PUT = withRateLimit(
  async function PUT(req: NextRequest): Promise<NextResponse> {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (body === null || body === undefined) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = GeoPutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 422 },
      );
    }

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const existing = await getOrDefault(db, user.id, 'geo', DEFAULT_GEO);
      const merged = mergeJurisdiction(existing, parseResult.data.targetJurisdiction);

      await set(db, user.id, 'geo', merged, (v: unknown) =>
        validatorFor('geo')(v) as typeof DEFAULT_GEO,
      );
      return NextResponse.json({ namespace: 'geo', value: merged });
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        return NextResponse.json(
          { error: 'Validation failed', message: err.message },
          { status: 422 },
        );
      }
      logger.error('[settings/geo] PUT failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  },
  WRITE_LIMIT,
);
