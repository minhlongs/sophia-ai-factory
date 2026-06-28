/**
 * GET /api/health/byok
 *
 * Returns the BYOK configuration status for the authenticated user.
 * Requires auth — returns 401 if no session.
 *
 * Response: { user_id, providers, provider_count, last_updated }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const providers = await listUserApiKeyProviders(user.id);

  return NextResponse.json({
    user_id: user.id,
    providers,
    provider_count: providers.length,
    last_updated: new Date().toISOString(),
  });
}
