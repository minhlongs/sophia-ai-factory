/**
 * GET /api/admin/tenant-lookup?tenantId=...
 *
 * Admin-only cross-table snapshot for a single tenant.
 * Returns 200 with summary, or 404 when tenant not found.
 *
 * @module app/api/admin/tenant-lookup/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getTenantSummary } from '@/land/observability/tenant-summary';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth; // eslint-disable-line @typescript-eslint/no-unused-vars

  const tenantId = new URL(request.url).searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    const summary = await getTenantSummary(tenantId);
    if (!summary) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (err) {
    logger.warn('[admin/tenant-lookup] query failed', { error: String(err) });
    return NextResponse.json({ error: 'Lookup query failed' }, { status: 500 });
  }
}
