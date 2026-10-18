/**
 * Dashboard Challenges Page — /dashboard/challenges
 *
 * Shows active challenges with user progress bars and reward info.
 * Server component: fetches data from D1.
 */

import { getTranslations } from 'next-intl/server';
import { Target, Flame } from 'lucide-react';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listActiveChallenges, getUserAllProgress } from '@/land/sop-marketplace/challenges';
import { cookies } from 'next/headers';
import { getD1 } from '@/seed/db/get-d1';
import { ChallengeCard, type ChallengeCardLabels } from './challenge-card';
import { StitchWave2RouteBanner } from '@/components/stitch/screens/control-deck/stitch-wave2-route-banner';

export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <StitchWave2RouteBanner routeKey="challenges" defaultShowCanvas={true} className="" />
      </div>
    );
  }

  const jar = await cookies();
  const locale = jar.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'vi';

  const t = await getTranslations('challenges');

  const db = await getD1();
  const [challenges, allProgress] = db
    ? await Promise.all([
        listActiveChallenges(db),
        getUserAllProgress(db, user.id),
      ])
    : [[], []];

  const progressMap = new Map(allProgress.map((p) => [p.challenge_id, p]));

  const cardLabels: ChallengeCardLabels = {
    claimed: t('claimed'),
    completed: t('completed'),
    progress: t('progress'),
    badge: t('badge'),
    credits: t('credits'),
    commissionBoost: t('commissionBoost'),
    daysLeft: t('daysLeft'),
    claimReward: t('claimReward'),
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <StitchWave2RouteBanner routeKey="challenges" className="" />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10">
          <Flame className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <RouteHelpTooltip locale={locale} routeKey="challenges" />
      </div>

      {/* Challenge list */}
      {challenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Target className="w-10 h-10 opacity-40" />
          <p className="text-sm">{t('noChallenges')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              progress={progressMap.get(challenge.id)}
              locale={locale}
              labels={cardLabels}
            />
          ))}
        </div>
      )}
    </div>
  );
}
