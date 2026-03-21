/**
 * GET /api/affiliate/programs
 *
 * List affiliate programs with optional filters.
 * Public endpoint — no auth required (used for program discovery UI).
 *
 * Query params:
 *   niche       - filter by niche (saas, marketing, design, ...)
 *   min_score   - minimum score threshold (default: 0)
 *   is_active   - boolean filter (default: true)
 *   limit       - page size (default: 20, max: 100)
 *   offset      - pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import type { ProgramNiche } from '@/types/affiliate';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const niche = searchParams.get('niche') as ProgramNiche | null;
    const minScore = parseInt(searchParams.get('min_score') ?? '0', 10);
    const isActive = searchParams.get('is_active') !== 'false'; // default true
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10),
      MAX_LIMIT
    );
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const supabase = createServerClient();

    let query = supabase
      .from('affiliate_programs')
      .select('*', { count: 'exact' })
      .eq('is_active', isActive)
      .gte('score', isNaN(minScore) ? 0 : minScore)
      .order('score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (niche) {
      query = query.eq('niche', niche);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('GET /api/affiliate/programs error:', error);
      return NextResponse.json({ error: 'Failed to fetch programs' }, { status: 500 });
    }

    return NextResponse.json({
      programs: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    console.error('GET /api/affiliate/programs unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
