/**
 * Leaderboard page — /dashboard/leaderboard
 *
 * Server Component. Two tabs via searchParams:
 *  - "creators" (default): top SOP authors by total_sales
 *  - "affiliates": top affiliates via getTopAffiliates()
 *
 * Time filter (searchParams.period): 7d | 30d | all (default: 30d)
 *
 * @module app/[locale]/dashboard/leaderboard/page
 */

import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTopAffiliates } from '@/land/affiliates/leaderboard';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { TabSwitcher } from './tab-switcher';
import { CreatorsTable, AffiliatesTable, type CreatorRow } from './leaderboard-tables';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Leaderboard | Sophia AI' };
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; period?: string }>;
}

interface RawCreatorRow {
  author_user_id: string;
  sop_count: number;
  sales: number;
  revenue: number;
}

const PERIOD_SECONDS: Record<string, number> = {
  '7d': 7 * 86400,
  '30d': 30 * 86400,
  all: 0,
};

async function fetchCreators(fromTs: number, toTs: number): Promise<CreatorRow[]> {
  const db = await getD1Raw();
  const whereClause =
    fromTs > 0
      ? `AND l.created_at >= ${fromTs} AND l.created_at <= ${toTs}`
      : '';
  const result = await db
    .prepare(
      `SELECT t.author_user_id,
              COUNT(*) AS sop_count,
              SUM(l.total_sales) AS sales,
              SUM(l.total_revenue_cents) AS revenue
       FROM sop_listings l
       JOIN sop_templates t ON t.id = l.template_id
       WHERE l.status = 'published'
         AND t.author_user_id IS NOT NULL
         ${whereClause}
       GROUP BY t.author_user_id
       ORDER BY sales DESC
       LIMIT 50`,
    )
    .all<RawCreatorRow>();

  return (result.results ?? []).map((r) => ({
    authorUserId: r.author_user_id,
    sopCount: Number(r.sop_count),
    sales: Number(r.sales ?? 0),
    revenueCents: Number(r.revenue ?? 0),
  }));
}

// ---------------------------------------------------------------------------

export default async function LeaderboardPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const tab = sp.tab === 'affiliates' ? 'affiliates' : 'creators';
  const period = ['7d', '30d', 'all'].includes(sp.period ?? '') ? (sp.period as string) : '30d';

  const now = Math.floor(Date.now() / 1000);
  const fromTs = PERIOD_SECONDS[period] ? now - PERIOD_SECONDS[period] : 0;
  const toTs = now;

  let creators: CreatorRow[] = [];
  let affiliates: Awaited<ReturnType<typeof getTopAffiliates>> = [];
  let loadError: string | null = null;

  try {
    if (tab === 'creators') {
      creators = await fetchCreators(fromTs, toTs);
    } else {
      affiliates = await getTopAffiliates(fromTs || 1, toTs, 50, 'commission');
    }
  } catch (err) {
    loadError = 'Leaderboard temporarily unavailable. Please refresh.';
    logger.error('[LeaderboardPage] Failed to load', toError(err), { userId: user.id, tab });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Leaderboard</h1>
        <p className="text-muted-foreground text-sm">Top creators and affiliates</p>
      </header>

      <Suspense>
        <TabSwitcher
          activeTab={tab}
          activePeriod={period}
          tabLabels={{ creators: 'Top Creators', affiliates: 'Top Affiliates' }}
          periodLabels={{ '7d': '7 Days', '30d': '30 Days', all: 'All Time' }}
        />
      </Suspense>

      {loadError && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
        >
          {loadError}
        </div>
      )}

      {tab === 'creators' ? (
        <CreatorsTable rows={creators} currentUserId={user.id} />
      ) : (
        <AffiliatesTable rows={affiliates} currentUserId={user.id} />
      )}
    </div>
  );
}
