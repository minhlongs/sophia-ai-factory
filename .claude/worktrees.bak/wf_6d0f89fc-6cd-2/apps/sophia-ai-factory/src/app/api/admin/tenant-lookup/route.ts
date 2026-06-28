/**
 * GET /api/admin/tenant-lookup?tenantId=...
 *
 * Admin-only cross-table snapshot for a single tenant.
 * Returns 200 with summary, or 404 when tenant not found.
 *
 * @module app/api/admin/tenant-lookup/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTenantSummary } from '@/land/observability/tenant-summary';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
