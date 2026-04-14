/**
 * GET /api/affiliate/clicks/stats
 *
 * Auth-required click stats per program/content.
 * Query params: programId (optional), contentId (optional), days (default 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createServerClient } from '@/lib/db/client';
import { resolveToken } from '@/lib/raas/resolve-token';
import { getOrgId } from '@/lib/org';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // SECURITY: Derive orgId from JWT, NOT from user-controllable header
  const authClient = createAuthClient(await resolveToken(req));
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const serverClient = createServerClient();
  const orgId = await getOrgId(user.id, serverClient);
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get('programId');
  const contentId = searchParams.get('contentId');
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '30')));

  const since = new Date();
  since.setDate(since.getDate() - days);

  // SECURITY: Scope clicks to programs owned by this org
  // First, get all program IDs owned by this org
  const { data: orgPrograms } = await serverClient
    .from('affiliate_programs')
    .select('id')
    .eq('org_id', orgId);

  const orgProgramIds = (orgPrograms ?? []).map((p: Record<string, string>) => p.id);

  if (orgProgramIds.length === 0) {
    return NextResponse.json({ total: 0, periodDays: days, byProgram: {}, byContent: {} });
  }

  // Verify requested programId belongs to this org
  if (programId && !orgProgramIds.includes(programId)) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  let query = serverClient
    .from('affiliate_clicks')
    .select('program_id, content_id, clicked_at', { count: 'exact' })
    .in('program_id', orgProgramIds)
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
