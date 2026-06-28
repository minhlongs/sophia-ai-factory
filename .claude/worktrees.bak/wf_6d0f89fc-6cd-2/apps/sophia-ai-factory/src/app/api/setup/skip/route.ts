/**
 * GET /api/setup/skip — auto-complete onboarding for users who already have
 * LLM keys configured. Route handlers can mutate cookies (Server Components cannot
 * since Next.js 15), which is why this lives outside the onboarding layout.
 *
 * @module app/api/setup/skip/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login?redirect=/dashboard/onboarding', request.url));
  }

  let hasLlmKey = false;
  try {
    const providers = await listUserApiKeyProviders(user.id);
    hasLlmKey = providers.includes('openrouter') || providers.includes('anthropic');
  } catch (err) {
    logger.error('[setup/skip] listUserApiKeyProviders failed', err instanceof Error ? err : undefined);
    return NextResponse.redirect(new URL('/dashboard/onboarding?error=lookup', request.url));
  }

  if (!hasLlmKey) {
    return NextResponse.redirect(new URL('/dashboard/onboarding', request.url));
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set(`wizard_done_${user.id.slice(0, 12)}`, '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
