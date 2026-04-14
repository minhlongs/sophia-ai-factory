/**
 * POST /api/auth/login
 *
 * DEPRECATED — Better Auth handles sign-in via /api/auth/sign-in/email.
 * This route is kept as a redirect shim for old clients.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/auth/sign-in/email via Better Auth client.' },
    { status: 410 },
  );
}
