/**
 * POST /api/auth/signup
 *
 * DEPRECATED — Better Auth handles sign-up via /api/auth/sign-up/email.
 * This route is kept as a redirect shim for old clients.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/auth/sign-up/email via Better Auth client.' },
    { status: 410 },
  );
}
