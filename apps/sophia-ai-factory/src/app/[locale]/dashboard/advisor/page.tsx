import React from 'react';
import dynamic from 'next/dynamic';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkAdmin, canAccessRevenue } from '@/lib/analytics/rbac';
import { TierGateCard } from '@/seed/components/ui/tier-gate-card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { redirect } from 'next/navigation';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

const RevenueAdvisorClient = dynamic(
  () => import('./components/revenue-advisor-client').then((m) => ({ default: m.RevenueAdvisorClient })),
  {
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-[380px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    ),
  },
);

export const metadata = {
  title: 'Revenue Advisor | Sophia AI',
  description: 'Financial insights, MRR tracking, and growth recommendations',
};

export default async function AdvisorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let userTier: Tier = 'BASIC';
  let isAdmin = false;
  try {
    [userTier, isAdmin] = await Promise.all([
      getUserTier(user.id),
      checkAdmin(user.id),
    ]);
  } catch (err) {
    logger.error('[Advisor] Failed to load tier/admin', toError(err));
  }

  const hasAccess = canAccessRevenue(userTier, isAdmin);

  if (!hasAccess) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue Advisor</h1>
          <p className="text-muted-foreground">Financial insights and growth recommendations</p>
        </div>
        <TierGateCard
          requiredTier="ENTERPRISE"
          currentTier={userTier}
          featureName="Revenue Advisor"
        >
          {null}
        </TierGateCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Advisor</h1>
        <p className="text-muted-foreground">Financial insights, MRR tracking, and growth recommendations</p>
      </div>
      <RevenueAdvisorClient userId={user.id} />
    </div>
  );
}
