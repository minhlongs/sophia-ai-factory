/**
 * Dynamic /llms-full.txt route handler exposing the complete Ground-Truth corpus
 * (all 4 tiers, 9 affiliate networks, BYOK providers, and 51 industry niches).
 */

import { NextResponse } from 'next/server';
import { buildLlmsFullCorpusText } from '@/tree/aeo';

export async function GET(): Promise<NextResponse> {
  const body = buildLlmsFullCorpusText();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'all',
    },
  });
}
