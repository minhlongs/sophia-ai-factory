/**
 * GET /api/affiliate/content
 *
 * List org's generated affiliate content.
 * Query params: contentType, status, programId, page, pageSize
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) {
    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get('contentType');
  const status = searchParams.get('status');
  const programId = searchParams.get('programId');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
  const offset = (page - 1) * pageSize;

  const db = createServerClient();

  let query = db
    .from('affiliate_content')
    .select('id, program_id, content_type, status, title, meta, created_at, updated_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (contentType) query = query.eq('content_type', contentType);
  if (status) query = query.eq('status', status);
  if (programId) query = query.eq('program_id', programId);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }

  return NextResponse.json({
    data: data || [],
    pagination: { page, pageSize, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) },
  });
}
