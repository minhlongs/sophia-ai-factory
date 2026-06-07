/**
 * Dashboard Challenges Page — /dashboard/challenges
 *
 * Shows active challenges with user progress bars and reward info.
 * Server component: fetches data from D1.
 */

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Target, Trophy, Flame } from 'lucide-react';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listActiveChallenges, getUserAllProgress } from '@/land/sop-marketplace/challenges';
import { claimChallengeRewardAction } from '@/app/actions/challenge-actions';
import { cookies } from 'next/headers';
import { getD1 } from '@/seed/db/get-d1';

export const dynamic = 'force-dynamic';


function daysLeft(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

function progressPct(current: number, goal: number): number {
  return Math.min(100, Math.round((current / goal) * 100));
}

const REWARD_ICONS: Record<string, string> = {
  badge: '🏅',
  credits: '⚡',
  commission_boost: '🚀',
};

export default async function ChallengesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const jar = await cookies();
  const locale = jar.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'vi';

  const t = await getTranslations('challenges');

  const db = getD1();
  const [challenges, allProgress] = db
    ? await Promise.all([
        listActiveChallenges(db),
        getUserAllProgress(db, user.id),
      ])
    : [[], []];

  const progressMap = new Map(allProgress.map(p => [p.challenge_id, p]));

  return (
    <div className="space-y-6 p-4 md:p-6">
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
          {challenges.map(challenge => {
            const prog = progressMap.get(challenge.id);
            const current = prog?.current_value ?? 0;
            const pct = progressPct(current, challenge.goal_value);
            const isCompleted = !!prog?.completed_at;
const isClaimed = !!prog?.reward_claimed;
            const title = locale === 'vi' ? challenge.title_vi : challenge.title_en;
            const desc = locale === 'vi' ? challenge.description_vi : challenge.description_en;
            const rewardIcon = REWARD_ICONS[challenge.reward_type] ?? '🎁';
            const days = daysLeft(challenge.ends_at);

            return (
      <div
      key={challenge.id}
      className={`rounded-xl border p-5 space-y-4 transition-colors ${isCompleted ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card hover:border-border/80'}`}
      >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground leading-tight">{title}</p>
                    {desc && (
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    )}
                  </div>
                  {isCompleted && (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                      <Trophy className="w-3 h-3" />
                      {prog?.reward_claimed ? t('claimed') : t('completed')}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('progress')}</span>
                    <span>{current} / {challenge.goal_value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isCompleted ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{pct}%</p>
                </div>

                {/* Reward + days left */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {rewardIcon}&nbsp;
                    {challenge.reward_type === 'badge' && `${t('badge')}: ${challenge.reward_value}`}
                    {challenge.reward_type === 'credits' && `${challenge.reward_value} ${t('credits')}`}
                    {challenge.reward_type === 'commission_boost' && `${t('commissionBoost')} ${challenge.reward_value}`}
                  </span>
                  {!isCompleted && (
                    <span className="text-muted-foreground">
                      {days} {t('daysLeft')}
                    </span>
                  )}
        {isCompleted && !isClaimed && (
        <form action={claimChallengeRewardAction}>
          <input type="hidden" name="challengeId" value={challenge.id} />
          <button
            type="submit"
            className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            {t('claimReward')}
          </button>
        </form>
        )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
