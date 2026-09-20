/**
 * API Route: Outbound Webhooks Subscription Management
 *
 * GET  /api/v1/webhooks — list all endpoints for current organization
 * POST /api/v1/webhooks — create a new endpoint (secret shown ONCE)
 *
 * Layer: app/api/v1/webhooks
 *
 * @module app/api/v1/webhooks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { D1Database } from '@/seed/db/client';
import { getCurrentUser, getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { assertTenantScope, CrossTenantViolationError } from '@/forest/tenant/isolation-guard';
import { canConfigureWebhooks } from '@/tree/rbac/permissions';
import { createWebhookEndpoint, listWebhookEndpointsByOrg } from '@/tree/webhooks/subscription-repo';
import type { OrgRole } from '@/seed/types/rbac-matrix';

export const runtime = 'edge';

const CreateEndpointSchema = z.object({
  orgId: z.string().optional(),
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol',
  }),
  events: z.array(z.string().min(1)).min(1, { message: 'Must subscribe to at least one event' }),
  description: z.string().max(256).optional().default(''),
  secret: z.string().optional(),
});

type CreatePayload = z.infer<typeof CreateEndpointSchema>;

/**
 * Resolves authenticated user from request headers or session cookies.
 */
async function resolveRequestUser(req: NextRequest) {
  try {
    const user = await getCurrentUserFromHeaders(req.headers);
    if (user) return user;
  } catch {
    // Ignore and fallback to cookie session
  }
  return getCurrentUser();
}

/**
 * Validates request payload against CreateEndpointSchema.
 */
function parseCreatePayload(body: unknown): { ok: true; data: CreatePayload } | { ok: false; response: Response } {
  const parsed = CreateEndpointSchema.safeParse(body);
  if (!parsed.success) {
    const isUrlError = parsed.error.issues.some((i) => i.message.includes('INVALID_WEBHOOK_URL'));
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: isUrlError ? 'INVALID_WEBHOOK_URL' : 'VALIDATION_FAILED',
          message: parsed.error.issues[0]?.message ?? 'Invalid payload',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Verifies whether a user has permission to configure webhooks in an organization.
 */
async function hasWebhookPermission(db: D1Database, orgId: string, user: { id: string; role?: string }): Promise<boolean> {
  if (user.role === 'admin') {
    return true;
  }

  const member = await db
    .prepare(
      `SELECT role FROM organization_members WHERE org_id = ?1 AND user_id = ?2
       UNION
       SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2
       LIMIT 1`
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  const userRole = (member?.role as OrgRole) ?? 'viewer';
  return canConfigureWebhooks(userRole);
}

export async function GET(req: NextRequest): Promise<Response> {
  const user = await resolveRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' }, { status: 503 });
  }

  const currentOrgId = await resolveOrgId(user.id, db);
  if (!currentOrgId) {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'No active organization found' }, { status: 403 });
  }

  const requestedOrgId = (req.nextUrl.searchParams.get('org_id') || req.nextUrl.searchParams.get('orgId') || currentOrgId).trim();
  try {
    assertTenantScope(currentOrgId, requestedOrgId);
  } catch (err) {
    if (err instanceof CrossTenantViolationError) {
      return NextResponse.json({ error: 'CROSS_TENANT_VIOLATION', message: err.message }, { status: 403 });
    }
    throw err;
  }

  try {
    const endpoints = await listWebhookEndpointsByOrg(db, requestedOrgId);
    const masked = endpoints.map((ep) => {
      const { secret: _secret, ...rest } = ep;
      return rest;
    });

    return NextResponse.json({ endpoints: masked });
  } catch (err) {
    logger.error('[API:Webhooks] Failed to list endpoints', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve endpoints' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await resolveRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }

  const db = await getD1();
  if (!db) {
    return NextResponse.json({ error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' }, { status: 503 });
  }

  const currentOrgId = await resolveOrgId(user.id, db);
  if (!currentOrgId) {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'No active organization found' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const validation = parseCreatePayload(body);
  if (!validation.ok) {
    return validation.response;
  }

  const targetOrgId = (validation.data.orgId || currentOrgId).trim();
  try {
    assertTenantScope(currentOrgId, targetOrgId);
  } catch (err) {
    if (err instanceof CrossTenantViolationError) {
      return NextResponse.json({ error: 'CROSS_TENANT_VIOLATION', message: err.message }, { status: 403 });
    }
    throw err;
  }

  const allowed = await hasWebhookPermission(db, currentOrgId, user);
  if (!allowed) {
    return NextResponse.json(
      { error: 'INSUFFICIENT_PERMISSIONS', message: 'User lacks permission canConfigureWebhooks' },
      { status: 403 },
    );
  }

  try {
    const endpoint = await createWebhookEndpoint(db, currentOrgId, {
      url: validation.data.url,
      secret: validation.data.secret,
      description: validation.data.description,
      events: validation.data.events,
    });

    logger.info('[API:Webhooks] Created subscription endpoint', {
      endpointId: endpoint.id,
      orgId: currentOrgId,
    });

    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUrlError = message.includes('INVALID_WEBHOOK_URL');
    return NextResponse.json(
      { error: isUrlError ? 'INVALID_WEBHOOK_URL' : 'INTERNAL_ERROR', message },
      { status: isUrlError ? 400 : 500 },
    );
  }
}
