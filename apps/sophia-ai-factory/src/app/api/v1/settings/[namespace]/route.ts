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
import { SETTINGS_NAMESPACES, SettingsValidationError } from '@/seed/tenant-settings/types';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import type { SettingsNamespace } from '@/seed/tenant-settings';
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

type RouteCtx = { params: Promise<{ namespace: string }> };

function resolveNamespace(raw: string): SettingsNamespace | null {
  return SETTINGS_NAMESPACES.includes(raw as SettingsNamespace)
    ? (raw as SettingsNamespace)
    : null;
}

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'PATCH body must be a plain object' }, { status: 400 });
    }

    // FIX-12: reject non-string keys and deeply nested values to prevent
    // injection via malformed PATCH payloads (arrays, functions, circular refs).
    const rawObj = body as Record<string, unknown>;
    const keyCheck = Object.keys(rawObj).every(
      k => typeof k === 'string' && /^[a-zA-Z_]/.test(k),
    );
    if (!keyCheck) {
      return NextResponse.json(
        { error: 'PATCH keys must be plain string identifiers starting with a letter' },
        { status: 400 },
      );
    }
    // Depth guard: reject payloads nested > 3 levels deep
    const maxDepth = (obj: unknown, d = 0): number => {
      if (d > 3 || typeof obj !== 'object' || obj === null) return d;
      return Math.max(0, ...Object.values(obj as Record<string, unknown>).map(v => maxDepth(v, d + 1)));
    };
    if (maxDepth(rawObj) > 3) {
      return NextResponse.json(
        { error: 'PATCH body too deeply nested (max 3 levels)' },
        { status: 400 },
      );
    }

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
