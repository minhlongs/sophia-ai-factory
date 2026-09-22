export const dynamic = 'force-dynamic';

/**
 * Admin Unit Economics API Route
 *
 * GET /api/admin/unit-economics?days=30
 *
 * @module app/api/admin/unit-economics/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnitEconomicsSummary } from '@/land/economics/unit-economics-service';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('api/admin/unit-economics');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const validatedDays = isNaN(days) || days <= 0 ? 30 : Math.min(365, days);

    const summary = await getUnitEconomicsSummary(validatedDays);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('API_UNIT_ECONOMICS_ERROR', { error: String(error) });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve unit economics summary',
      },
      { status: 500 }
    );
  }
}
