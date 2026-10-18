/**
 * Challenge Card Component — displays a single challenge with progress and claim form.
 */

import { Trophy } from 'lucide-react';
import { claimChallengeRewardAction } from '@/app/actions/challenge-actions';
import type { listActiveChallenges, getUserAllProgress } from '@/land/sop-marketplace/challenges';

type ChallengeItem = Awaited<ReturnType<typeof listActiveChallenges>>[number];
type ChallengeProgressItem = Awaited<ReturnType<typeof getUserAllProgress>>[number];

export function daysLeft(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function progressPct(current: number, goal: number): number {
  return Math.min(100, Math.round((current / goal) * 100));
}

const REWARD_ICONS: Record<string, string> = {
  badge: '🏅',
  credits: '⚡',
  commission_boost: '🚀',
};

export interface ChallengeCardLabels {
  claimed: string;
  completed: string;
  progress: string;
  badge: string;
  credits: string;
  commissionBoost: string;
  daysLeft: string;
  claimReward: string;
}

export interface ChallengeCardProps {
  challenge: ChallengeItem;
  progress?: ChallengeProgressItem;
  locale: 'vi' | 'en';
  labels: ChallengeCardLabels;
}

export function ChallengeCard({ challenge, progress, locale, labels }: ChallengeCardProps) {
  const current = progress?.current_value ?? 0;
  const pct = progressPct(current, challenge.goal_value);
  const isCompleted = !!progress?.completed_at;
  const isClaimed = !!progress?.reward_claimed;
  const title = locale === 'vi' ? challenge.title_vi : challenge.title_en;
  const desc = locale === 'vi' ? challenge.description_vi : challenge.description_en;
  const rewardIcon = REWARD_ICONS[challenge.reward_type] ?? '🎁';
  const days = daysLeft(challenge.ends_at);

  return (
    <div
      className={`rounded-xl border p-5 space-y-4 transition-colors ${
        isCompleted
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-border bg-card hover:border-border/80'
      }`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="font-semibold text-foreground leading-tight">{title}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
        {isCompleted && (
          <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
            <Trophy className="w-3 h-3" />
            {isClaimed ? labels.claimed : labels.completed}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{labels.progress}</span>
          <span>
            {current} / {challenge.goal_value}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">{pct}%</p>
      </div>

      {/* Reward + days left */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {rewardIcon}&nbsp;
          {challenge.reward_type === 'badge' && `${labels.badge}: ${challenge.reward_value}`}
          {challenge.reward_type === 'credits' && `${challenge.reward_value} ${labels.credits}`}
          {challenge.reward_type === 'commission_boost' &&
            `${labels.commissionBoost} ${challenge.reward_value}`}
        </span>
        {!isCompleted && (
          <span className="text-muted-foreground">
            {days} {labels.daysLeft}
          </span>
        )}
        {isCompleted && !isClaimed && (
          <form action={claimChallengeRewardAction}>
            <input type="hidden" name="challengeId" value={challenge.id} />
            <button
              type="submit"
              className="mt-2 w-full rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              {labels.claimReward}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
