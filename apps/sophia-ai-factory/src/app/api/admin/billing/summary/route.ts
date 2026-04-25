/**
 * GET /api/admin/billing/summary
 *
 * Get aggregate billing summary for admin dashboard.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { checkAdminAuth } from '../../middleware';
import { fetchBillingSummaryData, buildBillingSummary } from './billing-summary-query';

export async function GET(req: NextRequest) {
  try {
    const authError = checkAdminAuth(req);
    if (authError) return authError;

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
