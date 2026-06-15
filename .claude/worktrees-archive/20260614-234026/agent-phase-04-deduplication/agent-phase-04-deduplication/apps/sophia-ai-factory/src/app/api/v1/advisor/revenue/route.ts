/**
 * GET /api/v1/advisor/revenue — Revenue Advisor aggregated data.
 * Auth: Better Auth session + ENTERPRISE+ tier gate.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { checkAdmin, canAccessRevenue } from '@/land/analytics/rbac';
import { fetchRevenueSnapshot } from '@/land/analytics/queries/revenue-nowpayments';
import { fetchUnifiedRevenue } from '@/land/analytics/queries/revenue-unified-query';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';

export const dynamic = 'force-dynamic';

interface CommissionSummary {
  pending_usd: number;
  payable_usd: number;
  paid_usd: number;
  total_entries: number;
}

async function getCommissionAggregate(): Promise<CommissionSummary> {
  const db = await getD1Raw();
  const result = await db
    .prepare(
      `SELECT status,
              SUM(commission_cents - withheld_cents) AS net_cents,
              COUNT(*) AS cnt
       FROM commission_ledger
       GROUP BY status`,
    )
    .all<{ status: string; net_cents: number; cnt: number }>();

  const rows = result.results ?? [];
  let pending = 0, payable = 0, paid = 0, total = 0;
  for (const r of rows) {
    const usd = (r.net_cents ?? 0) / 100;
    total += r.cnt ?? 0;
    switch (r.status) {
      case 'pending': pending += usd; break;
      case 'payable': payable += usd; break;
      case 'paid': paid += usd; break;
    }
  }
  return { pending_usd: pending, payable_usd: payable, paid_usd: paid, total_entries: total };
}

export async function GET(): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
  try {
    user = await getCurrentUser();
  } catch { /* unauth */ }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let tier: Tier = 'BASIC';
  let isAdmin = false;
  try {
    tier = await resolveUserTier(user.id);
    isAdmin = tier === 'MASTER' || await checkAdmin(user.id);
  } catch (err) {
    logger.error('[API] Failed to resolve tier/admin', { error: getErrorMessage(err) });
  }

  if (!canAccessRevenue(tier, isAdmin)) {
    return NextResponse.json({ error: 'Upgrade to ENTERPRISE to access Revenue Advisor' }, { status: 403 });
  }

  try {
    const [snapshot, unified, commissions] = await Promise.all([
      fetchRevenueSnapshot('30d'),
      fetchUnifiedRevenue(30),
      getCommissionAggregate(),
    ]);

    const totalCustomers = snapshot.byTier.reduce((s, r) => s + r.customers, 0);

    return NextResponse.json({
      snapshot,
      unified,
      commissions,
      totalCustomers,
    });
  } catch (err) {
    logger.error('[API] GET /advisor/revenue failed', { error: getErrorMessage(err) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
