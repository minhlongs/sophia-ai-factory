/**
 * GDPR Account Data Export — GET /api/account/export
 * Phase 14: Launch Hardening
 *
 * Returns a JSON document containing all tenant-scoped data rows.
 * Authenticated via Better Auth session.
 *
 * @module app/api/account/export/route
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/** Tables that hold tenant-scoped user data for GDPR export */
export const TENANT_SCOPED_TABLES = [
  'users',
  'sessions',
  'affiliate_links',
  'conversion_events',
  'commission_ledger',
  'payout_batches',
  'publishing_channels',
  'publishing_jobs',
  'publishing_results',
  'video_jobs',
  'audit_log',
] as const;

interface ExportRow {
  table: string;
  rows: Record<string, unknown>[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (user as Record<string, unknown>).tenantId as string ?? user.id;

  let db: D1Database;
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    db = _db;
  } catch (err) {
    logger.warn('[gdpr-export] D1 unavailable', { error: String(err) });
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const exportData: ExportRow[] = [];

  for (const table of TENANT_SCOPED_TABLES) {
    try {
      const result = await db
        .prepare(`SELECT * FROM ${table} WHERE tenant_id = ? LIMIT 10000`)
        .bind(tenantId)
        .all<Record<string, unknown>>();
      exportData.push({ table, rows: result.results ?? [] });
    } catch {
      exportData.push({ table, rows: [] });
    }
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    tenantId,
    userId: user.id,
    tables: exportData,
  };

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="account-export-${tenantId}.json"`,
    },
  });
}
