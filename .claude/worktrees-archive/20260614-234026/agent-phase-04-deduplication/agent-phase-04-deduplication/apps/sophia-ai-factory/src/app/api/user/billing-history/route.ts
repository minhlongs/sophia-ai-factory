/**
 * GET /api/user/billing-history — returns user_purchases rows.
 * Query params: filter (all|30|90 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { globalRateLimiter, createRateLimitResponse } from '@/forest/middleware/rate-limiter';

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

  const rl = globalRateLimiter.checkLimit(`billing-history:${user.id}`, { intervalMs: 60_000, maxRequests: 60 });
  if (!rl.allowed) return createRateLimitResponse(rl);

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
