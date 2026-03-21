/**
 * GET  /api/affiliate/content/[id]  — single content detail
 * PATCH /api/affiliate/content/[id] — update status (publish, archive)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = ['draft', 'published', 'archived'] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orgId = _req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('affiliate_content')
    .select('*, affiliate_programs(name, company, logo_url)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { status } = body;
  if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('affiliate_content')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, status, updated_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Content not found or update failed' }, { status: 404 });
  }

  return NextResponse.json({ data });
}
