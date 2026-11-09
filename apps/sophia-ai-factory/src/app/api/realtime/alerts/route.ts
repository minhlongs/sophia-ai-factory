/**
 * Realtime Alerts Endpoint with Tenant Isolation (SEC-04)
 *
 * Enforces organization_id tenant isolation via verifyWorkspaceAccess for
 * session-authenticated callers while preserving internal CRON_SECRET access.
 *
 * @module api/realtime/alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) {
    return true;
  }
  return false;
}

async function extractOrganizationId(request: NextRequest): Promise<string | null> {
  const fromQuery =
    request.nextUrl.searchParams.get('organization_id') ??
    request.nextUrl.searchParams.get('orgId') ??
    request.headers.get('x-organization-id');
  if (fromQuery && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }
  if (request.method === 'POST' || request.method === 'DELETE') {
    try {
      const cloned = request.clone();
      const body = (await cloned.json()) as Record<string, unknown>;
      const fromBody = body?.organization_id ?? body?.orgId;
      if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
        return fromBody.trim();
      }
    } catch {
      // Ignore empty or non-JSON bodies
    }
  }
  return null;
}

async function authorizeAlertRequest(
  request: NextRequest,
): Promise<{ ok: true; organizationId: string | null } | { ok: false; response: NextResponse }> {
  const organizationId = await extractOrganizationId(request);
  const user = await getCurrentUser();

  if (user) {
    if (organizationId) {
      const d1 = await getD1();
      const hasAccess = await verifyWorkspaceAccess(organizationId, user.id, d1 ?? undefined);
      if (!hasAccess) {
        logger.warn('[Realtime Alerts API] Cross-tenant access denied', {
          userId: user.id,
          organizationId,
        });
        return {
          ok: false,
          response: NextResponse.json(
            { error: 'Forbidden: cross-tenant organization_id access denied' },
            { status: 403 },
          ),
        };
      }
    }
    return { ok: true, organizationId };
  }

  if (verifyCronSecret(request)) {
    return { ok: true, organizationId };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}

export async function GET(request: NextRequest) {
  const authResult = await authorizeAlertRequest(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  return NextResponse.json({
    status: 'unavailable',
    reason: 'Realtime subscriptions require Supabase; D1 does not support WebSocket subscriptions',
    organizationId: authResult.organizationId,
    subscriptions: [],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function DELETE(request: NextRequest) {
  const authResult = await authorizeAlertRequest(request);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    return NextResponse.json({
      status: 'noop',
      organizationId: authResult.organizationId,
      reason: 'No active subscriptions on D1',
    });
  } catch (error) {
    logger.error('[Realtime Alerts API] Cleanup error', toError(error));
    return NextResponse.json(
      { error: 'Failed to cleanup subscriptions' },
      { status: 500 },
    );
  }
}
