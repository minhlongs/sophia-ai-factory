/**
 * POST /api/setup/save
 *
 * Saves setup wizard API keys encrypted to `user_api_keys` D1 table.
 * CF Workers compatible — no filesystem access.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyCsrfToken } from '@/seed/security/csrf';
import {
  setupSaveSchema,
  persistConfiguredApiKeys,
  markSetupOnboardingComplete,
} from './setup-save-schema';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Defense-in-depth: explicit CSRF verification even though middleware checks it
  // This ensures protection if middleware is bypassed or misconfigured
  if (!verifyCsrfToken(request)) {
    return NextResponse.json(
      { success: false, message: 'Invalid CSRF token' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = setupSaveSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid configuration';
      return NextResponse.json(
        { success: false, message: firstError },
        { status: 400 },
      );
    }

    const saved = await persistConfiguredApiKeys(user.id, parsed.data.config);
    await markSetupOnboardingComplete(user.id);

    const response = NextResponse.json({
      success: true,
      message: 'API keys saved successfully.',
      saved,
      redirect: '/dashboard/settings',
    });

    // Mark wizard completed so middleware skips the new-user redirect on /dashboard.
    // The cookie is the fallback when the best-effort D1 onboarding write is unavailable.
    // Cookie name is per-user (`wizard_done_<uid12>`) — middleware reads the same shape.
    const uid12 = user.id.slice(0, 12);
    const cookieFlags = [
      `wizard_done_${uid12}=1`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 24 * 365}`,
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
    response.headers.append('Set-Cookie', cookieFlags);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}
