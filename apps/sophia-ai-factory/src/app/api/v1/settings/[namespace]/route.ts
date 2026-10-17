/**
 * GET/PUT/PATCH/DELETE /api/v1/settings/:namespace — single-namespace CRUD.

 * GET → returns current value (with default if row absent)
 * PUT → replaces entire namespace value (validates via Zod schema)
 * PATCH → shallow-merges partial value into existing
 * DELETE → removes the row (resets to default on next read)
 *
 * @module app/api/v1/settings/[namespace]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getOrDefault, set, merge, deleteNamespace } from '@/seed/tenant-settings/registry';
import { SettingsValidationError } from '@/seed/tenant-settings/types';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import { logger } from '@/seed/utils/logger-utility';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import {
  getD1,
  resolveNamespace,
  validatePatchBody,
  type RouteCtx,
} from './namespace-route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const value = await getOrDefault(db, user.id, namespace);
      return NextResponse.json({ namespace, value });
    } catch (err) {
      logger.error(`[settings/${namespace}] GET failed`, err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(req);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await r.json().catch(() => null);
    if (body === null || body === undefined) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      await set(db, user.id, namespace, body, validatorFor(namespace));
      return NextResponse.json({ namespace, updated: true });
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        return NextResponse.json({ error: 'Validation failed', message: err.message }, { status: 422 });
      }
      logger.error(`[settings/${namespace}] PUT failed`, err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await r.json().catch(() => null);
    const validated = validatePatchBody(body);
    if (!validated.ok) return validated.response;
    const { rawObj } = validated;

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const merged = await merge(
        db,
        user.id,
        namespace,
        rawObj,
      );
      return NextResponse.json({ namespace, value: merged });
    } catch (err) {
      if (err instanceof SettingsValidationError) {
        return NextResponse.json({ error: 'Validation failed', message: err.message }, { status: 422 });
      }
      logger.error(`[settings/${namespace}] PATCH failed`, err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      await deleteNamespace(db, user.id, namespace);
      return NextResponse.json({ namespace, deleted: true });
    } catch (err) {
      logger.error(`[settings/${namespace}] DELETE failed`, err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } })(req);
}
