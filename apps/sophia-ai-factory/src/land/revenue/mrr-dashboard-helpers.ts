/**
 * MRR Dashboard Internal Helpers
 *
 * Shared auth/DB guard and overview consolidation helpers for MRR Dashboard Server Actions.
 *
 * Layer: land/revenue
 * @module land/revenue/mrr-dashboard-helpers
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import type {
  MrrMilestoneProgress,
  UnifiedRevenueSnapshot,
} from '@/seed/types/unified-revenue';
import {
  aggregateRealtimeMrrFromD1,
  consolidateMrrChannels,
  getLatestUnifiedRevenueSnapshot,
} from '@/tree/revenue/mrr-consolidation-engine';

export function getCurrentPeriodMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function requireAuthenticatedD1(): Promise<
  | { ok: true; db: D1Database }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: 'UNAUTHORIZED: Authentication required' };
  }

  const db = await getD1();
  if (!db) {
    return { ok: false, error: 'Database unavailable' };
  }

  return { ok: true, db };
}

export async function resolveUnifiedMrrOverview(db: D1Database): Promise<{
  snapshot: UnifiedRevenueSnapshot;
  progress: MrrMilestoneProgress;
}> {
  const currentPeriod = getCurrentPeriodMonth();
  let snapshot = await getLatestUnifiedRevenueSnapshot(db);

  if (!snapshot || snapshot.periodMonth !== currentPeriod) {
    snapshot = await aggregateRealtimeMrrFromD1(db, currentPeriod);
  }

  const consolidated = consolidateMrrChannels({
    periodMonth: snapshot.periodMonth,
    directSalesCents: snapshot.directSalesCents,
    affiliateSalesCents: snapshot.affiliateSalesCents,
    contentSeoCents: snapshot.contentSeoCents,
    enterpriseDealsCents: snapshot.enterpriseDealsCents,
    activeCustomersCount: snapshot.activeCustomersCount,
    currency: snapshot.currency,
    status: snapshot.status,
  });

  return {
    snapshot,
    progress: consolidated.progress,
  };
}
