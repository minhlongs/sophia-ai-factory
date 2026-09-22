/**
 * Public Bilingual Affiliate Leaderboard Page
 *
 * Route: /[locale]/affiliate/leaderboard
 * Displays Top 10 Monthly Affiliates with podium rankings, tier badges,
 * and $850 USD bonus prize pool incentives.
 *
 * @module app/[locale]/affiliate/leaderboard/page
 */

import { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getMonthlyLeaderboard } from '@/land/affiliates/leaderboard-service';
import { AffiliateLeaderboardView } from '@/forest/affiliates/affiliate-leaderboard-view';
import { getD1 } from '@/seed/db/client';
import { LEADERBOARD_BONUS_POOL, LeaderboardSummary } from '@/seed/types/affiliate-expansion-types';

export const revalidate = 600; // Revalidate every 10 minutes

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';

  return {
    title: isVi
      ? 'Bảng Xếp Hạng Đối Tác Tiếp Thị Liên Kết | Sophia AI Factory'
      : 'Affiliate Partner Leaderboard & Hall of Fame | Sophia AI Factory',
    description: isVi
      ? 'Vinh danh Top 10 đối tác xuất sắc nhất tháng với quỹ giải thưởng $850 USD và chi trả hoa hồng kép VietQR/USDT.'
      : 'Top 10 monthly affiliate partner standings with $850 USD cash prize pool and dual-rail VietQR/USDT payouts.',
    alternates: {
      canonical: `/${locale}/affiliate/leaderboard`,
      languages: {
        en: '/en/affiliate/leaderboard',
        vi: '/vi/affiliate/leaderboard',
      },
    },
  };
}

export default async function AffiliateLeaderboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const initialLocale = (locale === 'en' ? 'en' : 'vi') as 'en' | 'vi';

  let summary: LeaderboardSummary;

  try {
    const d1 = await getD1();
    if (!d1) throw new Error('D1 unavailable');
    summary = await getMonthlyLeaderboard(d1);
  } catch {
    // Graceful fallback for build-time static generation when D1 is unavailable
    summary = {
      period: new Date().toISOString().slice(0, 7),
      totalPrizePoolUsd: LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD,
      topAffiliates: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return (
    <main className="min-h-screen bg-slate-950 py-8">
      <AffiliateLeaderboardView summary={summary} initialLocale={initialLocale} />
    </main>
  );
}
