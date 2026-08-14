/**
 * GET /api/admin/audit-log
 *
 * Admin-only audit log search.
 * Query params:
 *   tenantId, action, from (unix s), to (unix s), limit (1-500), offset (>=0)
 *
 * @module app/api/admin/audit-log/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { searchAuditLog } from '@/land/observability/audit-log-stats';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || undefined;
  const action = searchParams.get('action') || undefined;

  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const limitRaw = searchParams.get('limit');
  const offsetRaw = searchParams.get('offset');

  const fromTs = fromRaw ? parseInt(fromRaw, 10) : undefined;
  const toTs = toRaw ? parseInt(toRaw, 10) : undefined;
  const limit = limitRaw ? parseInt(limitRaw, 10) : 100;
  const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0;

  if (
    (fromTs !== undefined && Number.isNaN(fromTs)) ||
    (toTs !== undefined && Number.isNaN(toTs)) ||
    Number.isNaN(limit) || limit < 1 ||
    Number.isNaN(offset) || offset < 0 ||
    (fromTs !== undefined && toTs !== undefined && fromTs > toTs)
  ) {
    return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
  }

  try {
    const rows = await searchAuditLog({ tenantId, action, fromTs, toTs, limit, offset });
    return NextResponse.json({
      filters: { tenantId: tenantId ?? null, action: action ?? null, fromTs, toTs },
      limit, offset,
      count: rows.length,
      rows,
    });
  } catch (err) {
    logger.warn('[admin/audit-log] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Audit log query failed' }, { status: 500 });
  }
}
