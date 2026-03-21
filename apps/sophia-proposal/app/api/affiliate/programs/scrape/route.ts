/**
 * POST /api/affiliate/programs/scrape
 *
 * Trigger affiliate program scraper to refresh data.
 * Auth required. Deducts 5 MCU via usage-tracker.
 *
 * Returns: { inserted, updated, top_programs, errors }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, getUserOrganization } from '@/lib/supabase/auth';
import { logUsage } from '@/lib/billing/usage-tracker';
import { runScrape } from '@/lib/affiliate/program-scraper';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const user = await getCurrentUser(cookie);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await getUserOrganization(user.id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Deduct 5 MCU for scrape operation
    const usage = await logUsage({
      orgId: org.id,
      feature: 'affiliate:scrape',
      metadata: { triggered_by: user.id },
    });

    if (!usage.success) {
      return NextResponse.json(
        { error: 'Insufficient MCU balance', required: usage.mcuCost },
        { status: 402 }
      );
    }

    // Run scrape pipeline
    const result = await runScrape();

    return NextResponse.json({
      ...result,
      mcu_deducted: usage.mcuCost,
      remaining_balance: usage.remainingBalance,
    });
  } catch (e) {
    console.error('POST /api/affiliate/programs/scrape error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
