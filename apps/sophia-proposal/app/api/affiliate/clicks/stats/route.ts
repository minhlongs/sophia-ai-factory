/**
 * GET /api/affiliate/clicks/stats
 *
 * Auth-required click stats per program/content.
 * Query params: programId (optional), contentId (optional), days (default 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get('programId');
  const contentId = searchParams.get('contentId');
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30')));

  const since = new Date();
  since.setDate(since.getDate() - days);

  const db = createServerClient();

  // Verify org owns the program if filtering by program
  if (programId) {
    const { data: prog } = await db
      .from('affiliate_programs')
      .select('id')
      .eq('id', programId)
      .eq('org_id', orgId)
      .single();
    if (!prog) return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  let query = db
    .from('affiliate_clicks')
    .select('program_id, content_id, clicked_at', { count: 'exact' })
    .gte('clicked_at', since.toISOString());

  if (programId) query = query.eq('program_id', programId);
  if (contentId) query = query.eq('content_id', contentId);

  const { data: clicks, error, count } = await query;

  if (error) return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });

  // Aggregate by program
  const byProgram: Record<string, number> = {};
  const byContent: Record<string, number> = {};

  for (const click of (clicks ?? []) as Record<string, string>[]) {
    byProgram[click.program_id] = (byProgram[click.program_id] ?? 0) + 1;
    if (click.content_id) {
      byContent[click.content_id] = (byContent[click.content_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    total: count ?? 0,
    periodDays: days,
    byProgram,
    byContent,
  });
}
