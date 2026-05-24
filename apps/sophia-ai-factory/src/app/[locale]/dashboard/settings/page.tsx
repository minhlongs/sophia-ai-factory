import { Suspense } from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getUserProfile } from '@/app/actions/settings';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { ReferralShareWidget } from '@/forest/components/dashboard/referral-share-widget';
import { PlanUpgradeWidget } from '@/forest/components/dashboard/plan-upgrade-widget';
import { getSubscriptionPeriodEnd } from '@/land/billing/subscription-expiry';
import { countCompletedOrders } from '@/land/orders/order-counts';

const SettingsForm = dynamic(
  () => import('@/forest/components/settings/settings-form').then(m => ({ default: m.SettingsForm })),
  { loading: () => <SettingsSkeleton /> }
);

export const metadata: Metadata = {
  title: 'Settings - Sophia AI Factory',
  description: 'Manage your profile, preferences, and API keys.',
};

export default async function SettingsPage() {
  const [profile, user] = await Promise.all([getUserProfile(), getCurrentUser()]);
  if (!user) redirect('/login');

  const currentTier = user ? await getUserTier(user.id) : 'BASIC';
  const [periodEnd, completedOrderCount] = user
    ? await Promise.all([
        getSubscriptionPeriodEnd(user.id).catch(() => null),
        countCompletedOrders(user.id).catch(() => 0),
      ])
    : [null, 0];

  return (
    <div className="container mx-auto max-w-4xl py-10 space-y-6">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsForm defaultValues={profile} />
      </Suspense>
      <PlanUpgradeWidget
        currentTier={currentTier}
        periodEnd={periodEnd}
        showHistoryLink={completedOrderCount > 0}
      />
      <ReferralShareWidget />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 motion-safe:animate-pulse rounded-md bg-muted" />
        <div className="h-10 w-10 motion-safe:animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 w-full motion-safe:animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
