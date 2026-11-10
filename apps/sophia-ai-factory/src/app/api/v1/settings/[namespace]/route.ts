/**
 * GET/PUT/PATCH/DELETE /api/v1/settings/:namespace — single-namespace CRUD.
 * @module app/api/v1/settings/[namespace]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getOrDefault, set, merge, deleteNamespace } from '@/seed/tenant-settings/registry';
import { validatorFor } from '@/seed/tenant-settings/namespace-validators';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import {
  enforceNamespaceGate,
  getD1,
  handleSettingsError,
  mergeValidator,
  resolveNamespace,
  validatePatchBody,
  type RouteCtx,
} from './namespace-route-helpers';

export const dynamic = 'force-dynamic';

const READ_LIMIT = { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } };
const WRITE_LIMIT = { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gateResp = await enforceNamespaceGate(user.id, namespace);
    if (gateResp) return gateResp;
    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const value = await getOrDefault(db, user.id, namespace);
      return NextResponse.json({ namespace, value });
    } catch (err) {
      return handleSettingsError(namespace, 'GET', err);
    }
  }, READ_LIMIT)(req);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gateResp = await enforceNamespaceGate(user.id, namespace);
    if (gateResp) return gateResp;

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
      return handleSettingsError(namespace, 'PUT', err);
    }
  }, WRITE_LIMIT)(req);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gateResp = await enforceNamespaceGate(user.id, namespace);
    if (gateResp) return gateResp;

    const body = await r.json().catch(() => null);
    const validated = validatePatchBody(body);
    if (!validated.ok) return validated.response;

    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      const merged = await merge(
        db,
        user.id,
        namespace,
        validated.rawObj,
        mergeValidator(namespace),
      );
      return NextResponse.json({ namespace, value: merged });
    } catch (err) {
      return handleSettingsError(namespace, 'PATCH', err);
    }
  }, WRITE_LIMIT)(req);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const { namespace: raw } = await ctx.params;
  return withRateLimit(async (r: NextRequest) => {
    const namespace = resolveNamespace(raw);
    if (!namespace) return NextResponse.json({ error: 'Unknown namespace' }, { status: 404 });
    const user = await getCurrentUserFromHeaders(r.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const gateResp = await enforceNamespaceGate(user.id, namespace);
    if (gateResp) return gateResp;
    const db = await getD1();
    if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

    try {
      await deleteNamespace(db, user.id, namespace);
      return NextResponse.json({ namespace, deleted: true });
    } catch (err) {
      return handleSettingsError(namespace, 'DELETE', err);
    }
  }, WRITE_LIMIT)(req);
}
