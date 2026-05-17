/**
 * POST /api/user/cancel-subscription
 * Sets a cancel_requested_at flag in user_profiles settings.
 * Actual cancellation handled manually by ops team.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { globalRateLimiter, createRateLimitResponse } from '@/forest/middleware/rate-limiter';

export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = globalRateLimiter.checkLimit(`cancel-sub:${user.id}`, { intervalMs: 60_000, maxRequests: 5 });
  if (!rl.allowed) return createRateLimitResponse(rl);

  const db = createServerClient();
  const { data: existing } = await db
    .from('user_profiles')
    .select('settings')
    .eq('user_id', user.id)
    .single();

  let settings: Record<string, unknown> = {};
  try {
    if (existing?.settings) settings = JSON.parse(existing.settings as string) as Record<string, unknown>;
  } catch { /* ignore */ }

  settings.cancel_requested_at = Math.floor(Date.now() / 1000);

  const { error } = await db
    .from('user_profiles')
    .update({ settings: JSON.stringify(settings), updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to record cancellation request' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Cancellation requested. Your plan stays active until end of billing period.' });
}
