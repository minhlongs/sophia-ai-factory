/**
 * GET/PUT/PATCH/DELETE /api/v1/settings/:namespace — single-namespace CRUD.
 *
 * GET    → returns current value (with default if row absent)
 * PUT    → replaces entire namespace value (validates via Zod schema)
 * PATCH  → shallow-merges partial value into existing
 * DELETE → removes the row (resets to default on next read)
 *
 * @module app/api/v1/settings/[namespace]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { registry, SETTINGS_NAMESPACES, SettingsValidationError } from '@/lib/tenant-settings';
import { validatorFor } from '@/lib/tenant-settings/namespace-validators';
import type { SettingsNamespace } from '@/lib/tenant-settings';
import { logger } from '@/seed/utils/logger-utility';

export const runtime = 'edge';
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
  const namespace = resolveNamespace(raw);
  if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const value = await registry.getOrDefault(db, user.id, namespace);
    return NextResponse.json({ namespace, value });
  } catch (err) {
    logger.error(`[settings/${namespace}] GET failed`, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  const namespace = resolveNamespace(raw);
  if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (body === null || body === undefined) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    await registry.set(db, user.id, namespace, body, validatorFor(namespace));
    return NextResponse.json({ namespace, updated: true });
  } catch (err) {
    if (err instanceof SettingsValidationError) {
      return NextResponse.json({ error: 'Validation failed', message: err.message }, { status: 422 });
    }
    logger.error(`[settings/${namespace}] PUT failed`, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  const namespace = resolveNamespace(raw);
  if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'PATCH body must be a plain object' }, { status: 400 });
  }

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const merged = await registry.merge(
      db,
      user.id,
      namespace,
      body as Record<string, unknown>,
    );
    return NextResponse.json({ namespace, value: merged });
  } catch (err) {
    if (err instanceof SettingsValidationError) {
      return NextResponse.json({ error: 'Validation failed', message: err.message }, { status: 422 });
    }
    logger.error(`[settings/${namespace}] PATCH failed`, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  const namespace = resolveNamespace(raw);
  if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });

  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getD1();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    await registry.deleteNamespace(db, user.id, namespace);
    return NextResponse.json({ namespace, deleted: true });
  } catch (err) {
    logger.error(`[settings/${namespace}] DELETE failed`, err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
