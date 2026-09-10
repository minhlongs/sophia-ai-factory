/**
 * GET /api/setup-wizard/readiness
 *
 * Returns live server-side readiness scorecard for the current authenticated user.
 * Derived dynamically from actual D1 records, BYOK store, and credit balance.
 *
 * @module app/api/setup-wizard/readiness/route
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyUserReadiness } from '@/tree/readiness/readiness-checker';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const emailVerified = Boolean(
    (user as unknown as { emailVerified?: boolean | number }).emailVerified
  );

  const readiness = await verifyUserReadiness({
    userId: user.id,
    userEmail: user.email,
    emailVerified,
  });

  return NextResponse.json(readiness);
}
