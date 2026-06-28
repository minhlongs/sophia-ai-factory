/**
 * GET /api/admin/billing/summary
 *
 * Get aggregate billing summary for admin dashboard.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireAdmin } from '@/seed/auth/require-admin';
import { fetchBillingSummaryData, buildBillingSummary } from './billing-summary-query';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {

    const rawData = await fetchBillingSummaryData();
    const summary = buildBillingSummary(rawData);

    logger.info('[Billing Summary] Retrieved summary', {
      mrr: summary.mrr,
      dunningStates: summary.dunningStates,
      unbilledOverageTotal: summary.unbilledOverageTotal,
      activeLicensesCount: summary.activeLicensesCount,
    });

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('[Billing Summary] Error', toError(error));
    return NextResponse.json(
      { error: 'Failed to fetch billing summary' },
      { status: 500 }
    );
  }
}
