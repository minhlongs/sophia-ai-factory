export const dynamic = 'force-dynamic';

/**
 * Referral Dashboard — /dashboard/referral
 *
 * Server component that queries referral_rewards and referral_codes
 * for referral stats, reward history, and shareable link.
 * Renders the ReferralShareWidget and ReferralStatsSection.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { ReferralStatsSection } from '@/forest/components/dashboard/referral-stats-section';
import { ReferralShareWidget } from '@/forest/components/dashboard/referral-share-widget';
import { REFERRAL_REWARD_CENTS } from '@/seed/config/tiers/tier-configs';
import { Link } from '@/seed/navigation';
import { ArrowLeft, Gift, Users, DollarSign } from 'lucide-react';
import { logger } from '@/seed/utils/logger-utility';

interface RewardRow {
  id: string;
  referred_user_id: string;
  reward_cents: number;
  created_at: string;
}

interface StatsRow {
  total_referred: number;
  total_rewards: number;
  total_earned_cents: number;
}

const EMPTY_STATS: StatsRow = { total_referred: 0, total_rewards: 0, total_earned_cents: 0 };

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function ReferralPage({ params }: { params: Promise<{ locale: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.referral' });

  const d1 = getD1();

  // Fetch referral code
  let codeRow: { code: string; uses: number; reward_amount: number } | null = null;
  if (d1) {
    try {
      codeRow = await d1
        .prepare('SELECT code, uses, reward_amount FROM referral_codes WHERE user_id = ?')
        .bind(user.id)
        .first<{ code: string; uses: number; reward_amount: number }>();
    } catch (e) {
      logger.error('[referral/page] Failed to fetch referral code', e instanceof Error ? e : new Error(String(e)));
    }
  }

  // Fetch referral reward stats
  let stats: StatsRow = EMPTY_STATS;
  if (d1) {
    try {
      const row = await d1
        .prepare(
          'SELECT COUNT(DISTINCT referred_user_id) as total_referred, COUNT(*) as total_rewards, COALESCE(SUM(reward_cents), 0) as total_earned_cents FROM referral_rewards WHERE referrer_id = ?',
        )
        .bind(user.id)
        .first<StatsRow>();
      stats = row ?? EMPTY_STATS;
    } catch (e) {
      logger.error('[referral/page] Failed to fetch reward stats', e instanceof Error ? e : new Error(String(e)));
    }
  }

  // Fetch reward history
  let history: RewardRow[] = [];
  if (d1) {
    try {
      const result = await d1
        .prepare(
          'SELECT id, referred_user_id, reward_cents, created_at FROM referral_rewards WHERE referrer_id = ? ORDER BY created_at DESC LIMIT 50',
        )
        .bind(user.id)
        .all<RewardRow>();
      history = result.results ?? [];
    } catch (e) {
      logger.error('[referral/page] Failed to fetch reward history', e instanceof Error ? e : new Error(String(e)));
    }
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
  const shareUrl = codeRow ? `${baseUrl}/signup?ref=${codeRow.code}` : null;
  const rewardAmount = codeRow?.reward_amount ?? REFERRAL_REWARD_CENTS;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Back navigation */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t('backToDashboard')}
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('totalReferrals')}</p>
            <p className="text-xl md:text-2xl font-bold mt-0.5">{stats.total_referred}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 md:p-5 flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('totalEarned')}</p>
            <p className="text-xl md:text-2xl font-bold mt-0.5">
              ${dollars(stats.total_earned_cents)}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 md:p-5 flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Gift className="w-5 h-5 text-amber-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('rewardPerReferral')}</p>
            <p className="text-xl md:text-2xl font-bold mt-0.5">${dollars(rewardAmount)}</p>
          </div>
        </div>
      </div>

      {/* Share widget — shows existing code or prompts to generate */}
      <ReferralShareWidget
        initialCode={codeRow?.code ?? null}
        initialShareUrl={shareUrl}
      />

      {/* Reward history ledger */}
      <ReferralStatsSection history={history} locale={locale} />
    </div>
  );
}
