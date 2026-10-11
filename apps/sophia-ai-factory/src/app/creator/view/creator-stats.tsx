// i18n-namespace: marketplace.creator
import EarningsChart from '@/components/creator/EarningsChart';
import type { EarningsSectionProps, ChallengesSectionProps } from './types';

export function EarningsSection({
  profile,
  totalInstalls,
  earningsBreakdown,
  t,
}: EarningsSectionProps) {
  return (
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
  );
}

export function ChallengesSection({
  challenges,
  userProgress,
  locale,
  t,
}: ChallengesSectionProps) {
  const progressMap = new Map(userProgress.map((p) => [p.challenge_id, p]));

  return (
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
  );
}
