import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getUserProfile } from '@/app/actions/settings';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getSubscriptionPeriodEnd } from '@/land/billing/subscription-expiry';
import { countCompletedOrders } from '@/land/orders/order-counts';

const StitchSettingsPage = dynamic(
  () => import('@/components/stitch/screens/settings/settings-page'),
  { loading: () => <SettingsSkeleton /> }
);

export const metadata: Metadata = {
  title: 'Settings - Sophia AI Factory',
  description: 'Manage your profile, preferences, and API keys.',
};

export default async function SettingsPage() {
  // Preserve ALL existing data fetching and business logic
  const [profile, user] = await Promise.all([getUserProfile(), getCurrentUser()]);
  if (!user) redirect('/login');

  const currentTier = user ? await resolveUserTier(user.id) : 'BASIC';
  const [periodEnd, completedOrderCount] = user
    ? await Promise.all([
        getSubscriptionPeriodEnd(user.id).catch(() => null),
        countCompletedOrders(user.id).catch(() => 0),
      ])
    : [null, 0];

  return (
    <StitchSettingsPage
      userName={profile.fullName}
      userEmail={profile.email}
      currentTier={currentTier}
      periodEnd={periodEnd}
      completedOrderCount={completedOrderCount}
    />
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
