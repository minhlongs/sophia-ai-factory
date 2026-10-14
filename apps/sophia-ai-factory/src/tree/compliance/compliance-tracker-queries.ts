/**
 * Read and reporting queries for compliance metadata.
 * @module tree/compliance/compliance-tracker-queries
 */

import { getD1 } from '@/seed/db/client';
import type { ComplianceRecord, ComplianceReport } from '@/seed/types/compliance';
import { toRecord, type RawRow } from './compliance-tracker-helpers';

/** Aggregate compliance statistics for a user, optionally bounded by date range. */
export async function getComplianceReport(
  userId: string,
  opts?: { fromDate?: number; toDate?: number },
): Promise<ComplianceReport> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const bindings: (string | number)[] = [userId];

  let query = `SELECT compliance_type, platform, verified FROM compliance_metadata WHERE user_id = ?1`;
  if (opts?.fromDate !== undefined) {
    bindings.push(opts.fromDate);
    query += ` AND created_at >= ?${bindings.length}`;
  }
  if (opts?.toDate !== undefined) {
    bindings.push(opts.toDate);
    query += ` AND created_at <= ?${bindings.length}`;
  }

  const rows = await db
    .prepare(query)
    .bind(...bindings)
    .all<{ compliance_type: string; platform: string | null; verified: number }>();

  const byType: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  let verifiedCount = 0;

  for (const row of rows.results) {
    byType[row.compliance_type] = (byType[row.compliance_type] ?? 0) + 1;
    if (row.platform) byPlatform[row.platform] = (byPlatform[row.platform] ?? 0) + 1;
    if (row.verified === 1) verifiedCount++;
  }

  const total = rows.results.length;
  return {
    userId,
    totalRecords: total,
    verifiedCount,
    unverifiedCount: total - verifiedCount,
    byType: byType as ComplianceReport['byType'],
    byPlatform,
  };
}

/**
 * Returns true when every compliance_metadata row for an execution is verified.
 */
export async function isCompliant(executionId: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count
       FROM compliance_metadata WHERE execution_id = ?1`,
    )
    .bind(executionId)
    .first<{ total: number; verified_count: number }>();

  if (!row || row.total === 0) return false;
  return row.total === row.verified_count;
}

/** Retrieve all compliance records associated with an execution, oldest first. */
export async function getRecordsForExecution(executionId: string): Promise<ComplianceRecord[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const result = await db
    .prepare(`SELECT * FROM compliance_metadata WHERE execution_id = ?1 ORDER BY created_at ASC`)
    .bind(executionId)
    .all<RawRow>();

  return result.results.map(toRecord);
}
