/**
 * GDPR Account Data Export — GET + POST /api/account/export
 * Phase 14: Launch Hardening
 * Wave 20 Phase 04: added POST handler + audit trail logging.
 *
 * Returns a JSON document containing all tenant-scoped data rows.
 * Authenticated via Better Auth session. POST logs an audit trail entry.
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

/**
 * Log an export event to the D1 usage_logs table for audit trail.
 */
async function logExportAudit(
  db: D1Database,
  userId: string,
  tenantId: string,
  totalRows: number,
  tableCount: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO usage_logs (id, org_id, feature, quantity, metadata, created_at)
         VALUES (lower(hex(randomblob(16))), ?, 'account_export', 1, ?, datetime('now'))`,
      )
      .bind(
        tenantId,
        JSON.stringify({
          userId,
          tenantId,
          totalRowsExported: totalRows,
          tablesIncluded: tableCount,
          exportedAt: new Date().toISOString(),
        }),
      )
      .run();
  } catch (err) {
    // Non-fatal — don't block the export if audit log write fails.
    logger.warn('[gdpr-export] audit log write failed', { error: String(err) });
  }
}

async function handleExport(): Promise<NextResponse> {
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

  const totalRows = exportData.reduce((sum, t) => sum + t.rows.length, 0);

  const payload = {
    exportedAt: new Date().toISOString(),
    tenantId,
    userId: user.id,
    tables: exportData,
  };

  // Log audit trail (non-blocking — fires and forgets on error)
  logExportAudit(db, user.id, tenantId, totalRows, exportData.length);

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="account-export-${tenantId}.json"`,
    },
  });
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  return handleExport();
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return handleExport();
}
