/**
 * Affiliate Dashboard — /dashboard/affiliate
 *
 * Server Component. Fetches real data for the authenticated affiliate
 * and renders the Stitch AffiliateDashboardPage component.
 *
 * Data primitives: `getAffiliateClickStats`, `getRecentConversions` from `@/land/affiliates/dashboard-stats`.
 * Uses canonical Sophia tier-gated dashboard pattern (server-fetched, dynamic rendering).
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import {
  getAffiliateClickStats,
  getRecentConversions,
  type ConversionFeedRow,
} from '@/land/affiliates/dashboard-stats';
import { getEarningsSummary } from '@/land/payouts/commission-ledger';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { Users, UserCheck, DollarSign, Clock } from 'lucide-react';
import { AffiliateDashboardPage as StitchAffiliateDashboard } from '@/components/stitch/screens/affiliate';

export const dynamic = 'force-dynamic';

interface ClickStats {
  totalClicks: number;
  totalConversions: number;
  epc: number;
}

const EMPTY_STATS: ClickStats = { totalClicks: 0, totalConversions: 0, epc: 0 };

function fmtUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtDate(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

/** Map DB conversion status to Stitch display status. */
function mapStatus(dbStatus: ConversionFeedRow['status']): 'paid' | 'pending' | 'clawback' {
  switch (dbStatus) {
    case 'approved':
    case 'paid':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'clawback';
  }
}

export default async function AffiliateDashboardPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - 30 * 86400;

  // Each fetch wrapped independently so one bad table does not crash the dashboard.
  // Browser bug-hunt 2026-05-19 caught a hard 500 when Promise.all bubbled a D1 error.
  let stats: ClickStats = EMPTY_STATS;
  let conversions: ConversionFeedRow[] = [];
  let pendingEarnings = 0;
  let loadError: string | null = null;

  try {
    const [s, c, e] = await Promise.all([
      getAffiliateClickStats(user.id, user.id, fromTs, now),
      getRecentConversions(user.id, user.id, 50, 0),
      getEarningsSummary(user.id, user.id, fromTs, now),
    ]);
    stats = s;
    conversions = c;
    pendingEarnings = e
      .filter((row) => row.status === 'pending' || row.status === 'payable')
      .reduce((sum, row) => sum + row.total_usd, 0);
  } catch (err) {
    loadError = 'Affiliate stats temporarily unavailable. Please refresh in a moment.';
    logger.error('[AffiliateDashboardPage] Failed to load stats', toError(err), { userId: user.id });
  }

  // Map server data to Stitch KPI metrics
  const kpiMetrics = [
    { id: 'totalReferrals', value: stats.totalClicks.toLocaleString(), icon: Users },
    { id: 'active', value: stats.totalConversions.toLocaleString(), icon: UserCheck },
    { id: 'commissionEarned', value: fmtUsd(stats.epc), icon: DollarSign },
    { id: 'pending', value: fmtUsd(pendingEarnings), icon: Clock },
  ];

  // Map DB conversion rows to Stitch conversion rows
  const stitchedConversions = conversions.map((c) => ({
    id: c.conversionId,
    transactionId: c.networkTransactionId || `#TRX-${c.conversionId.slice(0, 4).toUpperCase()}`,
    amount: fmtUsd(c.grossAmountUsd),
    commission: fmtUsd(c.commissionUsd),
    status: mapStatus(c.status),
    date: fmtDate(c.attributedAt),
  }));

  return (
    <>
      {loadError && (
        <div
          role="alert"
          className="rounded-none border-b border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
        >
          {loadError}
        </div>
      )}
      <StitchAffiliateDashboard
        kpiMetrics={kpiMetrics}
        conversions={stitchedConversions}
      />
    </>
  );
}
