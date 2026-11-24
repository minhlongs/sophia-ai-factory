/**
 * Founder-only Brand Domain Lifecycle & Readiness Transition API
 * PATCH /api/admin/domains/[id]
 *
 * Supports:
 * - action: 'update_checks' — updates individual 10-gate readiness flags
 * - action: 'verify'        — transitions to VERIFIED (requires ownership + zone gates)
 * - action: 'activate'      — transitions to ACTIVE (requires ALL 10/10 gates)
 * - action: 'suspend'       — transitions to SUSPENDED and invalidates host cache
 * - action: 'rollback'      — transitions to SUSPENDED with ROLLED_BACK audit event
 *
 * @module app/api/admin/domains/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/admin';
import { getD1 } from '@/seed/db/client';
import {
  invalidateDynamicHostCache,
  type BrandDomainReadinessChecks,
} from '@/seed/domain';
import {
  READINESS_CHECK_KEYS,
  syncActiveBrandDomainsFromD1,
  transitionBrandDomainStatus,
  updateBrandDomainChecks,
} from '@/tree/brand-domains';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

type DomainPatchAction =
  | 'update_checks'
  | 'verify'
  | 'activate'
  | 'suspend'
  | 'rollback';

interface PatchRequestBody {
  action?: unknown;
  checks?: unknown;
  reason?: unknown;
}

function parseChecksPayload(
  raw: unknown,
): Partial<BrandDomainReadinessChecks> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const parsed: Partial<Record<keyof BrandDomainReadinessChecks, boolean>> = {};
  for (const key of READINESS_CHECK_KEYS) {
    if (key in record) {
      if (typeof record[key] !== 'boolean') return null;
      parsed[key] = record[key];
    }
  }
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: 'Invalid domain id' }, { status: 400 });
  }

  let body: PatchRequestBody;
  try {
    body = (await request.json()) as PatchRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (
    action !== 'update_checks' &&
    action !== 'verify' &&
    action !== 'activate' &&
    action !== 'suspend' &&
    action !== 'rollback'
  ) {
    return NextResponse.json(
      { error: 'Unsupported action' },
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

    const actor = {
      actorId: auth.user.id,
      actorEmail: auth.user.email ?? null,
    };

    let updated;
    if (action === 'update_checks') {
      const checks = parseChecksPayload(body.checks);
      if (!checks || Object.keys(checks).length === 0) {
        return NextResponse.json(
          { error: 'Valid boolean readiness checks are required' },
          { status: 400 },
        );
      }
      updated = await updateBrandDomainChecks(db, id, checks, actor);
    } else {
      const reason =
        typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined;
      updated = await transitionBrandDomainStatus(
        db,
        id,
        action as Exclude<DomainPatchAction, 'update_checks'>,
        actor,
        reason,
      );
      if (action === 'activate' || action === 'suspend' || action === 'rollback') {
        invalidateDynamicHostCache();
        await syncActiveBrandDomainsFromD1({ db, force: true });
      }
    }

    return NextResponse.json(
      { domain: updated },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    const err = toError(error);
    if (err.message.includes('not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err.message.includes('Cannot activate') ||
      err.message.includes('must be verified')
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    logger.error('[admin/domains/[id]] PATCH failed', err);
    return NextResponse.json(
      { error: 'Failed to update brand domain' },
      { status: 500 },
    );
  }
}
