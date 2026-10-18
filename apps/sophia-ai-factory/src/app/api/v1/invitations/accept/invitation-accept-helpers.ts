/**
 * Invitation Acceptance & Token Verification Helpers
 *
 * Layer: app/api/v1/invitations/accept
 */

import { type NextRequest } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { sha256Hex } from '@/seed/security/invitation-token';

type D1Binding = NonNullable<Awaited<ReturnType<typeof getD1>>>;

export interface InvitationRow {
  id: string;
  org_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: number;
}

export async function extractInvitationToken(request: NextRequest): Promise<string> {
  try {
    const body = (await request.json()) as { token?: string } | null;
    return (body?.token || '').trim();
  } catch {
    return (request.nextUrl.searchParams.get('token') || '').trim();
  }
}

export function resolveAcceptanceErrorStatus(message: string): number {
  if (message.includes('INVALID_INVITATION_TOKEN')) {
    return 404;
  }
  if (message.includes('SEAT_QUOTA_EXCEEDED')) {
    return 409;
  }
  if (message.includes('INVITATION_ALREADY_USED') || message.includes('INVITATION_EXPIRED')) {
    return 410;
  }
  return 400;
}

export async function lookupInvitationByToken(
  db: D1Binding,
  token: string,
): Promise<InvitationRow | null> {
  const tokenHash = await sha256Hex(token);

  const primary = await db
    .prepare(
      `SELECT id, org_id, email, role, status, expires_at
       FROM org_invitations
       WHERE token_hash = ?1 LIMIT 1`,
    )
    .bind(tokenHash)
    .first<InvitationRow>();

  if (primary) {
    return primary;
  }

  return await db
    .prepare(
      `SELECT id, org_id, email, role, status, expires_at
       FROM organization_invitations
       WHERE token_hash = ?1 LIMIT 1`,
    )
    .bind(tokenHash)
    .first<InvitationRow>();
}
