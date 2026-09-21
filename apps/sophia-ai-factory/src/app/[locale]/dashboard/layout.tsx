export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getMcuMonthlyLimit } from '@/seed/config/tiers/unified-limits';
import { getBalance } from '@/tree/mcu/credits-repo';
import { DashboardShell } from '@/forest/dashboard/dashboard-shell';
import type { Tier } from '@/seed/types';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isVi = locale === 'vi';
  const user = await getCurrentUser();

  let userTier: Tier = 'PRO' as Tier;
  let isAdmin = false;
  let quotaTotal = 1000;
  let quotaUsed = 0;
  let quotaUsagePercent = 0;

  if (user) {
    try {
      userTier = await getUserTier(user.id);
    } catch {
      userTier = 'PRO' as Tier;
    }
    const role = (user as { role?: string }).role;
    isAdmin = role === 'admin' || userTier === 'MASTER';

    try {
      const monthlyAllowance = getMcuMonthlyLimit(userTier);
      const balance = await getBalance(user.id);
      quotaTotal = Number.isFinite(monthlyAllowance) && monthlyAllowance > 0 ? monthlyAllowance : 1000;
      const safeUsed = Number.isFinite(balance.credits_total_used) ? Math.max(0, balance.credits_total_used) : 0;
      quotaUsed = safeUsed;
      quotaUsagePercent =
        Number.isFinite(quotaTotal) && quotaTotal > 0
          ? Math.min(100, Math.max(0, Math.round((quotaUsed / quotaTotal) * 100)))
          : 0;
      if (!Number.isFinite(quotaUsagePercent)) {
        quotaUsagePercent = 0;
      }
    } catch {
      quotaTotal = 1000;
      quotaUsed = 0;
      quotaUsagePercent = 0;
    }
  }

  const dashboardUser = user
    ? {
        name: user.full_name || (isVi ? 'Nhà Sáng Lập Sophia' : 'Sophia Founder'),
        email: user.email || 'founder@sophia.ai',
        avatarUrl: user.avatar_url || null,
        tier: userTier,
        quotaUsagePercent,
        quotaUsed,
        quotaTotal,
      }
    : {
        name: isVi ? 'Nhà Sáng Lập Sophia' : 'Sophia Founder',
        email: 'founder@sophia.ai',
        tier: 'PRO',
        quotaUsagePercent: 0,
        quotaUsed: 0,
        quotaTotal: 1000,
      };

  return (
    <DashboardShell user={dashboardUser} isAdmin={isAdmin} isVi={isVi}>
      {children}
    </DashboardShell>
  );
}
