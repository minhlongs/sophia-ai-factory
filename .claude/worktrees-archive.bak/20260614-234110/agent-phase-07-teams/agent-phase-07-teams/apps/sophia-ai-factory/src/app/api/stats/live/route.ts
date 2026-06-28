/**
 * GET /api/stats/live
 *
 * Public endpoint feeding the homepage social-proof section. No auth
 * required; counters are aggregate totals only (no PII).
 *
 * Edge-cache: 60s with stale-while-revalidate so cold homepage paints
 * stay below ~150ms.
 *
 * @module app/api/stats/live
 */
import { NextResponse } from 'next/server';
import { getLiveStats } from '@/land/stats/live-stats-counters';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const stats = await getLiveStats();
  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
