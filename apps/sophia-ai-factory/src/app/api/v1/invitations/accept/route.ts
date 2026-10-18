/**
 * API Route: Invitation Acceptance & Token Verification
 *
 * Endpoint: /api/v1/invitations/accept
 *
 * POST: Authenticated acceptance of an invitation token.
 * GET: Public pre-flight validation of token status without consumption.
 *
 * Layer: app/api/v1/invitations/accept
 *
 * @module app/api/v1/invitations/accept/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { acceptOrgInvitation } from '@/tree/organizations/invitation-service';
import {
  extractInvitationToken,
  lookupInvitationByToken,
  resolveAcceptanceErrorStatus,
} from './invitation-accept-helpers';

export const runtime = 'edge';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required to accept invitation' },
        { status: 401 },
      );
    }

    const token = await extractInvitationToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invitation token is required' },
        { status: 400 },
      );
    }

    const db = await getD1();
    if (!db) {
      return NextResponse.json(
        { error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' },
        { status: 503 },
      );
    }

    const result = await acceptOrgInvitation(db, token, user.id);

    logger.info('[API:Invitations] Invitation accepted successfully', {
      orgId: result.orgId,
      userId: user.id,
      role: result.role,
    });

    return NextResponse.json({
      success: true,
      orgId: result.orgId,
      role: result.role,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[API:Invitations] Acceptance failed', { error: message });

    return NextResponse.json(
      { error: 'ACCEPT_FAILED', message },
      { status: resolveAcceptanceErrorStatus(message) },
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = (request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invitation token parameter is required' },
        { status: 400 },
      );
    }

    const db = await getD1();
    if (!db) {
      return NextResponse.json(
        { error: 'DB_UNAVAILABLE', message: 'Database connection unavailable' },
        { status: 503 },
      );
    }

    const invitation = await lookupInvitationByToken(db, token);
    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: 'INVALID_INVITATION_TOKEN', message: 'Invitation token not found' },
        { status: 404 },
      );
    }

    const isExpired = Date.now() > invitation.expires_at;
    const isValid = invitation.status === 'pending' && !isExpired;

    return NextResponse.json({
      valid: isValid,
      invitationId: invitation.id,
      orgId: invitation.org_id,
      email: invitation.email,
      role: invitation.role,
      status: isExpired ? 'expired' : invitation.status,
      expiresAt: invitation.expires_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'VERIFICATION_FAILED', message },
      { status: 500 },
    );
  }
}
