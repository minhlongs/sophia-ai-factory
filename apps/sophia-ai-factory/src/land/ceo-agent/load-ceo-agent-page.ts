/**
 * loadCeoAgentPage — shared server-side helper for the CEO Agent page.
 *
 * Pure server function: no JSX, no 'use client'. Unit-testable without RTL.
 * Used by the page component to resolve auth + tier before rendering.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';

export interface CeoAgentPageResult {
  user: { id: string };
  userTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  locale: string;
}

export async function loadCeoAgentPage(params: { params: Promise<{ locale: string }> }): Promise<CeoAgentPageResult> {
  const { locale } = await params.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let userTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' = 'BASIC';
  try {
    userTier = (await resolveUserTier(user.id)) as any;
  } catch {
    // Degrade to BASIC on D1 failure — don't block navigation.
  }

  return { user, userTier, locale };
}
