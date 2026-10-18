/**
 * GET /api/admin/byok-audit
 *
 * Admin-only query for BYOK audit trail events.
 * Reads JSONL from R2 (AUDIT_BUCKET) and returns filtered, paginated events.
 *
 * Query params:
 *   tenantId (optional) — filter by tenant
 *   event   (optional) — filter by event type (key.created|key.rotated|...)
 *   from    (unix s)   — filter events after this timestamp
 *   limit   (1-500)    — max records to return (default 100)
 *   offset  (>=0)      — records to skip (default 0)
 *
 * GET /api/admin/byok-audit/health — check audit trail read/write health
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getAuditBucket } from '@/seed/utils/jsonl-append';
import { logger } from '@/seed/utils/logger-utility';
import { byokAuditQuerySchema, queryByokAuditTrail } from './byok-audit-query';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { success, data, error } = byokAuditQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.format() },
        { status: 400 },
      );
    }

    const bucket = await getAuditBucket();
    if (!bucket) {
      return NextResponse.json({ error: 'Audit trail unavailable' }, { status: 503 });
    }

    const payload = await queryByokAuditTrail(bucket, data);
    return NextResponse.json(payload);
  } catch (err) {
    logger.warn('[admin/byok-audit] query failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Audit query failed' }, { status: 500 });
  }
}
