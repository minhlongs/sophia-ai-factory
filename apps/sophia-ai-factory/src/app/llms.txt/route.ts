/**
 * Dynamic /llms.txt route handler synchronized with TIER_CONFIGS and NICHE_SLUGS.
 */

import { NextResponse } from 'next/server';
import { buildLlmsIndexText } from '@/tree/aeo';

export async function GET(): Promise<NextResponse> {
  const body = buildLlmsIndexText();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  });
}
