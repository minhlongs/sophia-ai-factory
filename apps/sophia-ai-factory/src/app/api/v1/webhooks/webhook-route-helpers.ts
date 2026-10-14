/**
 * Validation and RBAC helpers for /api/v1/webhooks route.
 * @module app/api/v1/webhooks/webhook-route-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { D1Database } from '@/seed/db/client';
import { getCurrentUser, getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { canConfigureWebhooks } from '@/tree/rbac/permissions';
import type { OrgRole } from '@/seed/types/rbac-matrix';

export const CreateEndpointSchema = z.object({
  orgId: z.string().optional(),
  url: z.string().url().refine((u) => u.startsWith('https://'), {
    message: 'INVALID_WEBHOOK_URL: Webhook URL must use HTTPS protocol',
  }),
  events: z.array(z.string().min(1)).min(1, { message: 'Must subscribe to at least one event' }),
  description: z.string().max(256).optional().default(''),
  secret: z.string().optional(),
});

export type CreatePayload = z.infer<typeof CreateEndpointSchema>;

/**
 * Resolves authenticated user from request headers or session cookies.
 */
export async function resolveRequestUser(req: NextRequest) {
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
export function parseCreatePayload(
  body: unknown,
): { ok: true; data: CreatePayload } | { ok: false; response: Response } {
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
export async function hasWebhookPermission(
  db: D1Database,
  orgId: string,
  user: { id: string; role?: string },
): Promise<boolean> {
  if (user.role === 'admin') {
    return true;
  }

  const member = await db
    .prepare(
      `SELECT role FROM organization_members WHERE org_id = ?1 AND user_id = ?2
       UNION
       SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2
       LIMIT 1`,
    )
    .bind(orgId, user.id)
    .first<{ role: string }>();

  const userRole = (member?.role as OrgRole) ?? 'viewer';
  return canConfigureWebhooks(userRole);
}
