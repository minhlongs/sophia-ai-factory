/**
 * GET /api/user/billing-history — returns user_purchases rows.
 * Query params: filter (all|30|90 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';

interface PurchaseRow {
  id: string;
  kind: string;
  sku: string;
  amount_cents: number;
  status: string;
  created_at: number;
  paid_at: number | null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') ?? 'all';

  const db = createServerClient();

  let query = db
    .from('user_purchases')
    .select('id,kind,sku,amount_cents,status,created_at,paid_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (filter === '30') {
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    query = query.gte('created_at', cutoff);
  } else if (filter === '90') {
    const cutoff = Math.floor(Date.now() / 1000) - 90 * 86400;
    query = query.gte('created_at', cutoff);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 });
  }

  const rows = (data as unknown as PurchaseRow[]) ?? [];
  return NextResponse.json({ purchases: rows });
}
