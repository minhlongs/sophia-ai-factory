/**
 * Founder-only Brand Domain Registry API
 * GET  /api/admin/domains — List technical identity, static hosts, brand domains, and audit events
 * POST /api/admin/domains — Register a new brand domain in PENDING state (no auto-activation)
 *
 * @module app/api/admin/domains/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminWithRecentAuth } from '@/seed/auth/admin';
import { getD1 } from '@/seed/db/client';
import {
  getStaticAllowedHosts,
  getTechnicalRuntimeIdentity,
} from '@/seed/domain';
import {
  listBrandDomainAuditEvents,
  listBrandDomains,
  registerBrandDomain,
} from '@/tree/brand-domains';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

interface RegisterRequestBody {
  hostname?: unknown;
  workerName?: unknown;
  cloudflareZoneId?: unknown;
  tenantId?: unknown;
  authPolicy?: unknown;
  isCanonical?: unknown;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const technicalIdentity = getTechnicalRuntimeIdentity();
  const staticAllowedHosts = Array.from(getStaticAllowedHosts());

  try {
    const db = await getD1();
    if (!db) {
      return NextResponse.json(
        { error: 'D1 database binding not available' },
        { status: 503 },
      );
    }

    const [domains, auditEvents] = await Promise.all([
      listBrandDomains(db),
      listBrandDomainAuditEvents(db, 50),
    ]);

    return NextResponse.json(
      {
        technicalIdentity,
        staticAllowedHosts,
        domains,
        auditEvents,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    logger.error('[admin/domains] GET failed', toError(error));
    return NextResponse.json(
      {
        error: 'Failed to load brand domain registry',
        technicalIdentity,
        staticAllowedHosts,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: RegisterRequestBody;
  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.hostname !== 'string' || !body.hostname.trim()) {
    return NextResponse.json(
      { error: 'hostname is required' },
      { status: 400 },
    );
  }

  const technicalIdentity = getTechnicalRuntimeIdentity();
  const workerName =
    typeof body.workerName === 'string' && body.workerName.trim()
      ? body.workerName.trim()
      : technicalIdentity.workerName;
  if (!/^[a-z0-9-]{1,63}$/.test(workerName)) {
    return NextResponse.json({ error: 'Invalid workerName format' }, { status: 400 });
  }

  const cloudflareZoneId =
    typeof body.cloudflareZoneId === 'string' && body.cloudflareZoneId.trim()
      ? body.cloudflareZoneId.trim()
      : null;
  if (cloudflareZoneId && !/^[a-f0-9]{32}$/i.test(cloudflareZoneId)) {
    return NextResponse.json(
      { error: 'Invalid cloudflareZoneId (expected 32-char hex ID)' },
      { status: 400 },
    );
  }

  const tenantId =
    typeof body.tenantId === 'string' && body.tenantId.trim()
      ? body.tenantId.trim()
      : null;
  if (tenantId && tenantId.length > 128) {
    return NextResponse.json({ error: 'Invalid tenantId (max 128 chars)' }, { status: 400 });
  }

  const ALLOWED_AUTH_POLICIES = new Set(['standard', 'strict', 'invite-only']);
  const authPolicy =
    typeof body.authPolicy === 'string' && body.authPolicy.trim()
      ? body.authPolicy.trim()
      : 'standard';
  if (!ALLOWED_AUTH_POLICIES.has(authPolicy)) {
    return NextResponse.json(
      { error: 'Invalid authPolicy (allowed: standard, strict, invite-only)' },
      { status: 400 },
    );
  }

  try {
    const db = await getD1();
    if (!db) {
      return NextResponse.json(
        { error: 'D1 database binding not available' },
        { status: 503 },
      );
    }

    const created = await registerBrandDomain(
      db,
      {
        hostname: body.hostname,
        workerName,
        cloudflareZoneId,
        tenantId,
        authPolicy,
        isCanonical: body.isCanonical === true,
      },
      {
        actorId: auth.user.id,
        actorEmail: auth.user.email ?? null,
      },
    );

    return NextResponse.json(
      { domain: created },
      { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const err = toError(error);
    const isValidation =
      err.message.includes('Invalid') ||
      err.message.includes('already registered') ||
      err.message.includes('cannot be registered') ||
      err.message.includes('technical runtime');
    if (isValidation) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    logger.error('[admin/domains] POST failed', err);
    return NextResponse.json(
      { error: 'Failed to register brand domain' },
      { status: 500 },
    );
  }
}
