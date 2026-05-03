/**
 * GET /api/admin/handover/list
 * Returns all handovers with pagination.
 *
 * @module app/api/admin/handover/list/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getD1Raw } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100);
  const offset = Number(url.searchParams.get('offset') ?? '0');

  try {
    const db = await getD1Raw();

    let query = `SELECT * FROM customer_handovers`;
    const bindings: (string | number)[] = [];

    if (status && ['pending', 'active', 'at_risk', 'churned'].includes(status)) {
      query += ` WHERE status = ?1`;
      bindings.push(status);
      query += ` ORDER BY created_at DESC LIMIT ?2 OFFSET ?3`;
      bindings.push(limit, offset);
    } else {
      query += ` ORDER BY created_at DESC LIMIT ?1 OFFSET ?2`;
      bindings.push(limit, offset);
    }

    const stmt = db.prepare(query);
    const bound = bindings.length > 0 ? stmt.bind(...bindings) : stmt;
    const { results } = await bound.all();

    return NextResponse.json({ handovers: results });
  } catch (err) {
    logger.error('[Handover/List] Query failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Failed to fetch handovers' }, { status: 500 });
  }
}
