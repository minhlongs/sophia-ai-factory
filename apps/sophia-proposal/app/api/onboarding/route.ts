/**
 * POST /api/onboarding
 *
 * Authenticated endpoint — creates org for the current logged-in user.
 * Used by /onboarding page (OrgSetupForm) when user already has auth-token.
 * Returns: { organization: { id: string } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOrganization } from '@/lib/raas/onboarding';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Verify authenticated
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Extract user from JWT
  let userId: string;
  let userEmail: string;
  try {
    const { verifyJwt } = await import('@/lib/db/auth-verify');
    const payload = await verifyJwt(token);
    if (!payload?.sub || !payload?.email) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    userId = payload.sub as string;
    userEmail = payload.email as string;
  } catch {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const orgName = typeof body.orgName === 'string' ? body.orgName.trim() : '';
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug.trim() : '';
  if (orgName.length < 2 || orgName.length > 100) {
    return NextResponse.json(
      { error: 'Organization name must be 2-100 characters' },
      { status: 400 },
    );
  }

  // Idempotency: check if user already has an org
  try {
    const { getUserOrganization } = await import('@/lib/db/auth');
    const existingOrg = await getUserOrganization(userId);
    if (existingOrg) {
      return NextResponse.json(
        { organization: { id: existingOrg.id } },
        { status: 200 },
      );
    }
  } catch {
    // Continue to create — getUserOrganization may fail if no org exists
  }

  try {
    const { org_id } = await createOrganization({
      name: orgName,
      email: userEmail,
      plan: 'starter',
    });

    // Link existing user to org via org_members
    const { getD1Client } = await import('@/lib/db/client');
    const db = await getD1Client();
    try {
      await db.from('org_members').insert({
        org_id,
        user_id: userId,
        role: 'owner',
      });
    } catch {
      // Ignore if already linked (UNIQUE constraint)
    }

    return NextResponse.json(
      { organization: { id: org_id } },
      { status: 201 },
    );
  } catch (err) {
    logger.error('POST /api/onboarding error', err, { path: '/api/onboarding', method: 'POST' });
    const message = err instanceof Error ? err.message : 'Failed';

    if (message.includes('UNIQUE') || message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Organization already exists' },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
