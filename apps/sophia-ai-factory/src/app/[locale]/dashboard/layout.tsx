export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { DashboardShell } from '@/forest/dashboard/dashboard-shell';

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

  let userTier = 'PRO';
  let isAdmin = false;

  if (user) {
    try {
      userTier = await getUserTier(user.id);
    } catch {
      userTier = 'PRO';
    }
    const role = (user as { role?: string }).role;
    isAdmin = role === 'admin' || userTier === 'MASTER';
  }

  const dashboardUser = user
    ? {
        name: user.full_name || (isVi ? 'Nhà Sáng Lập Sophia' : 'Sophia Founder'),
        email: user.email || 'founder@sophia.ai',
        avatarUrl: user.avatar_url || null,
        tier: userTier,
        quotaUsagePercent: 65,
        quotaUsed: 650,
        quotaTotal: 1000,
      }
    : {
        name: isVi ? 'Nhà Sáng Lập Sophia' : 'Sophia Founder',
        email: 'founder@sophia.ai',
        tier: 'PRO',
        quotaUsagePercent: 65,
        quotaUsed: 650,
        quotaTotal: 1000,
      };

  return (
    <DashboardShell user={dashboardUser} isAdmin={isAdmin} isVi={isVi}>
      {children}
    </DashboardShell>
  );
}
