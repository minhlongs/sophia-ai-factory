import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getCreatorProfile } from '@/land/sop-marketplace';
import { ReferralSection } from '@/components/billing/referral-section';
import type { DashboardViewProps } from './types';
import { ProfileCard, OnboardingView } from './creator-hero';
import { EarningsSection, ChallengesSection } from './creator-stats';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';
import { loadCreatorDashboardMetrics } from './creator-data-loader';

export function DashboardView({
  profile,
  totalInstalls,
  earningsBreakdown,
  challenges,
  userProgress,
  locale,
  t,
}: DashboardViewProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <ProfileCard profile={profile} t={t} />

      <EarningsSection
        profile={profile}
        totalInstalls={totalInstalls}
        earningsBreakdown={earningsBreakdown}
        t={t}
      />

      <ChallengesSection
        challenges={challenges}
        userProgress={userProgress}
        locale={locale}
        t={t}
      />

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t('referralEarn')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('referralDesc')}</p>
        <ReferralSection />
      </div>

      <div>
        <Link
          href="/creator/listings"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('listings')}
        </Link>
      </div>
    </div>
  );
}

export async function CreatorPage() {
  const t = await getTranslations('marketplace.creator');
  const locale = await getLocale();

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const profileResult = await getCreatorProfile();

  if (!profileResult.ok && profileResult.error.code === 'PROFILE_NOT_FOUND') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <OnboardingView t={t} />
      </div>
    );
  }

  if (!profileResult.ok && profileResult.error.code === 'MARKETPLACE_TEMPORARILY_UNAVAILABLE') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <MarketplaceUnavailableNotice />
      </div>
    );
  }

  if (!profileResult.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {profileResult.error.message}
        </div>
      </div>
    );
  }

  const { totalInstalls, earningsBreakdown, challenges, userProgress } =
    await loadCreatorDashboardMetrics(user.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
      </div>
      <DashboardView
        profile={profileResult.value}
        totalInstalls={totalInstalls}
        earningsBreakdown={earningsBreakdown}
        challenges={challenges}
        userProgress={userProgress}
        locale={locale}
        t={t}
      />
    </div>
  );
}
