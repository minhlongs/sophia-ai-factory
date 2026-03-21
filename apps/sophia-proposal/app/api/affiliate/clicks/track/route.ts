/**
 * GET /api/affiliate/clicks/track
 *
 * Public redirect endpoint — no auth required.
 * Tracks click then redirects to affiliate URL.
 * Params: ?pid=programId&cid=contentId (contentId optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { trackClick } from '@/lib/affiliate/click-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get('pid');
  const contentId = searchParams.get('cid') || null;

  if (!programId) {
    return NextResponse.json({ error: 'pid (program ID) is required' }, { status: 400 });
  }

  // Fetch affiliate URL — use service client for public lookup
  const supabase = createServerClient();
  const { data: program } = await supabase
    .from('affiliate_programs')
    .select('affiliate_url')
    .eq('id', programId)
    .single();

  if (!program?.affiliate_url) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  // Fire-and-forget click tracking (never blocks redirect)
  void trackClick(programId, contentId, req);

  // 302 redirect to affiliate URL
  return NextResponse.redirect(program.affiliate_url, { status: 302 });
}
