/**
 * /dashboard/account — Account & Billing page.
 * 3 tabs: Profile, Subscription, Billing History.
 * Server component: fetches initial profile + tier data.
 */

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { getUserTier } from '@/lib/db/get-user-tier';
import { createServerClient } from '@/lib/db/client';
import { TIER_CONFIG } from '@/config/tiers';
import { AccountTabs } from './account-tabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: `${t('title')} | Sophia AI` };
}

interface ProfileRow {
  settings: string | null;
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function AccountPage({ params }: Props) {
  const { locale: _locale } = await params;
  const t = await getTranslations('account');

  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [tier, profileResult] = await Promise.all([
    getUserTier(user.id),
    createServerClient()
      .from('user_profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single(),
  ]);

  let settings: Record<string, unknown> = {};
  try {
    const row = profileResult.data as ProfileRow | null;
    if (row?.settings) settings = JSON.parse(row.settings) as Record<string, unknown>;
  } catch { /* ignore */ }

  const tierMeta = TIER_CONFIG[tier];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('title')}</h1>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}>
        <AccountTabs
          profileData={{
            email: user.email ?? '',
            display_name: (settings.display_name as string) ?? user.full_name ?? '',
            locale: (settings.locale as string) ?? 'en',
            timezone: (settings.timezone as string) ?? 'Asia/Ho_Chi_Minh',
          }}
          tier={tier}
          tierLabel={tierMeta?.label ?? tier}
          tierFeatures={tierMeta?.features ?? []}
        />
      </Suspense>
    </div>
  );
}
