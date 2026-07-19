/**
 * /creator — Creator dashboard page.
 *
 * Server component that auth-gates and conditionally shows the onboarding form
 * (if the user is not yet registered as a creator) or the creator dashboard.
 *
 * @module app/creator/page
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/seed/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/get-d1';
import {
  getCreatorProfile,
  listMyListings,
  getCreatorEarnings,
  listActiveChallenges,
  getUserAllProgress,
} from '@/land/sop-marketplace';
import { CreatorOnboardingForm } from '@/components/creator/CreatorOnboardingForm';
import EarningsChart from '@/components/creator/EarningsChart';
import { ReferralSection } from '@/components/billing/referral-section';
import type { CreatorProfileView } from '@/land/sop-marketplace';
import type { SopChallengeRow, UserChallengeProgressRow } from '@/tree/sop/sop-types';

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function DashboardView({
  profile,
  totalInstalls,
  earningsBreakdown,
  challenges,
  userProgress,
  locale,
  t,
}: {
  profile: CreatorProfileView;
  totalInstalls: number;
  earningsBreakdown: { totalEarned: number; pending: number; payable: number; paid: number };
  challenges: SopChallengeRow[];
  userProgress: UserChallengeProgressRow[];
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const progressMap = new Map(userProgress.map((p) => [p.challenge_id, p]));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Profile Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="mb-4 text-lg font-semibold">
            {profile.displayName}
          </h2>
          <Link
            href="/creator/settings"
            className="rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 min-h-9"
          >
            {t('editProfile')}
          </Link>
        </div>
        <div className="space-y-3 text-sm">
          {profile.bio && (
            <div>
              <span className="font-medium text-muted-foreground">
                {t('bio')}:
              </span>{' '}
              {profile.bio}
            </div>
          )}
          <div>
            <span className="font-medium text-muted-foreground">
              {t('payoutMethod')}:
            </span>{' '}
            {profile.payoutMethod ?? '—'}
          </div>
          <div>
            <span className="font-medium text-muted-foreground">
              {t('payoutAddress')}:
            </span>{' '}
            {profile.payoutAddress ?? '—'}
          </div>
        </div>
      </div>

      {/* Earnings Card */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {t('earnings')}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-sm">{t('earnings')}</p>
            <p className="text-2xl font-bold">
              ${(profile.totalEarningsCents / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{t('installCount')}</p>
            <p className="text-2xl font-bold">{totalInstalls}</p>
          </div>
        </div>
        <div className="mt-6 border-t pt-4">
          <EarningsChart
            earnings={earningsBreakdown.totalEarned}
            pendingCents={earningsBreakdown.pending}
            payableCents={earningsBreakdown.payable}
            paidCents={earningsBreakdown.paid}
          />
        </div>
      </div>

      {/* Active Challenges */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {t('activeChallenges')}
        </h2>
        {challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('noChallenges')}
          </p>
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge) => {
              const progress = progressMap.get(challenge.id);
              const currentValue = progress?.current_value ?? 0;
              const goalValue = challenge.goal_value;
              const pct = goalValue > 0
                ? Math.min(Math.round((currentValue / goalValue) * 100), 100)
                : 0;
              const title = locale === 'vi' ? challenge.title_vi : challenge.title_en;
              const description =
                locale === 'vi'
                  ? challenge.description_vi
                  : challenge.description_en;

              return (
                <div key={challenge.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{title}</span>
                    <span className="text-muted-foreground text-xs">
                      {t('challengeProgress', {
                        completed: currentValue,
                        total: goalValue,
                      })}
                    </span>
                  </div>
                  {description && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      {description}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium">
                      {pct}%
                    </span>
                  </div>
                  {progress?.completed_at && (
                    <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                      {t('earningsHistory')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Referral Section — share your creator referral link */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">{t('referralEarn')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('referralDesc')}</p>
        <ReferralSection />
      </div>

      {/* My Listings Link */}
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

function OnboardingView({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('registerTitle')}</h1>
        <p className="mt-1 text-muted-foreground">{t('registerSubtitle')}</p>
      </div>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CreatorOnboardingForm />
      </div>
    </div>
  );
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketplace.creator');
  const title = t('title');
  const description = t('subtitle');
  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}/creator` },
    openGraph: { title, description, url: `${APP_URL}/creator`, siteName: 'Sophia AI Factory', type: 'website' },
    twitter: { title, description, card: 'summary_large_image' },
  };
}

export default async function CreatorPage() {
  const t = await getTranslations('marketplace.creator');
  const locale = await getLocale();

  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const profileResult = await getCreatorProfile();

  // Not registered yet — show onboarding form
  if (!profileResult.ok && profileResult.error.code === 'PROFILE_NOT_FOUND') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <OnboardingView t={t} />
      </div>
    );
  }

  // Unexpected error
  if (!profileResult.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {profileResult.error.message}
        </div>
      </div>
    );
  }

  // Registered — show dashboard
  const listingsResult = await listMyListings();
  const totalInstalls = listingsResult.ok
    ? listingsResult.value.reduce((sum, l) => sum + l.installCount, 0)
    : 0;

  // Fetch earnings breakdown, active challenges, and user progress
  const db = getD1();
  let earningsBreakdown = { totalEarned: 0, pending: 0, payable: 0, paid: 0 };
  let challenges: SopChallengeRow[] = [];
  let userProgress: UserChallengeProgressRow[] = [];

  if (db) {
    try {
      const [earnings, activeChallenges, progress] = await Promise.all([
        getCreatorEarnings(db, user.id),
        listActiveChallenges(db),
        getUserAllProgress(db, user.id),
      ]);
      earningsBreakdown = earnings;
      challenges = activeChallenges;
      userProgress = progress;
    } catch {
      // Graceful fallback — chart shows zeros, challenges section shows empty
    }
  }

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
