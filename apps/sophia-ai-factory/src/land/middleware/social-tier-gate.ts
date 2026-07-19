/**
 * Social Tier Gate — middleware pass for /dashboard/social/*
 *
 * Usage: import and call from src/forest/middleware/dashboard-pipeline.ts
 *   before the dashboard NextResponse.next() return.
 *
 * Redirects BASIC-tier users to the Social pricing upsell page
 * with a VN+EN bilingual flash message.
 *
 * Does NOT modify existing middleware.ts directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { TIER_SOCIAL_LIMITS } from '@/seed/config/tiers/tier-configs';

const SOCIAL_PREFIX = '/dashboard/social';

function isTierLocked(tier: string | undefined): boolean {
  const t = (tier ?? 'BASIC').toUpperCase();
  return TIER_SOCIAL_LIMITS[t as keyof typeof TIER_SOCIAL_LIMITS]?.socialEnabled === false;
}

/**
 * Read the user's tier from D1 using the session user id.
 * Returns null when user is not authenticated or DB is unavailable.
 */
async function resolveTier(userId: string): Promise<string | null> {
  try {
    const d1 = getD1();
    if (!d1) return null;
    const row = await d1
      .prepare(
        `SELECT tier, plan FROM subscriptions
         WHERE user_id = ?1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<{ tier: string | null; plan: string | null }>();
    const raw = row?.tier ?? row?.plan ?? null;
    if (!raw) return 'BASIC';
    return raw.toUpperCase();
  } catch {
    return 'BASIC';
  }
}

/**
 * Apply the social tier gate. Call from dashboard-pipeline.ts after auth.
 *
 * Returns a NextResponse redirect if the user is locked out, otherwise null.
 */
export async function applySocialTierGate(
  request: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(SOCIAL_PREFIX)) return null;

  const tier = await resolveTier(userId);
  if (!isTierLocked(tier)) return null;

  const locale = (pathname.split('/')[1] ?? 'vi') as 'vi' | 'en';
  const isVi = locale === 'vi';
  const flash = encodeURIComponent(
    isVi
      ? 'Nâng cấp lên PREMIUM để sử dụng tính năng Social Publishing'
      : 'Upgrade to PREMIUM to unlock Social Publishing',
  );
  const redirectUrl = `/${locale}/dashboard/pricing?social_locked=${flash}`;
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
