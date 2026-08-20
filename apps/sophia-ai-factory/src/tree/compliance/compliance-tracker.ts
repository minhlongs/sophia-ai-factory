/**
 * Compliance Tracker — domain logic for recording and querying compliance metadata.
 *
 * Writes to the `compliance_metadata` D1 table introduced in migration 0137.
 * All queries use parameterized statements (no string interpolation).
 *
 * Internal helpers (insert, row mapping) live in compliance-tracker-helpers.ts.
 *
 * @module tree/compliance/compliance-tracker
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AIDisclosure, C2PAMetadata, ComplianceRecord, ComplianceReport, Platform } from '@/seed/types/compliance';
import { insertComplianceRecord, nowSec, toRecord } from './compliance-tracker-helpers';
import type { RawRow } from './compliance-tracker-helpers';

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/** Record an AI disclosure for a piece of content. Returns the new record id. */
export async function recordDisclosure(params: {
  executionId: string;
  contentId?: string;
  userId: string;
  disclosure: AIDisclosure;
  platform?: Platform;
}): Promise<string> {
  try {
    return await insertComplianceRecord({
      executionId: params.executionId,
      contentId: params.contentId,
      userId: params.userId,
      complianceType: 'ai_disclosure',
      metadata: params.disclosure as unknown as Record<string, unknown>,
      platform: params.platform,
    });
  } catch (err) {
    logger.error('[complianceTracker] recordDisclosure failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/** Attach C2PA provenance metadata to a piece of content. Returns the new record id. */
export async function addC2PAMetadata(params: {
  executionId: string;
  contentId?: string;
  userId: string;
  c2pa: C2PAMetadata;
  platform?: Platform;
}): Promise<string> {
  try {
    return await insertComplianceRecord({
      executionId: params.executionId,
      contentId: params.contentId,
      userId: params.userId,
      complianceType: 'c2pa_metadata',
      metadata: params.c2pa as unknown as Record<string, unknown>,
      platform: params.platform,
    });
  } catch (err) {
    logger.error('[complianceTracker] addC2PAMetadata failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/** Record a platform Terms-of-Service compliance check. Returns the new record id. */
export async function recordPlatformTOSCheck(params: {
  executionId: string;
  contentId?: string;
  userId: string;
  platform: Platform;
  tosVersion: string;
  isCompliant: boolean;
}): Promise<string> {
  try {
    return await insertComplianceRecord({
      executionId: params.executionId,
      contentId: params.contentId,
      userId: params.userId,
      complianceType: 'platform_tos_check',
      metadata: { tosVersion: params.tosVersion, isCompliant: params.isCompliant },
      platform: params.platform,
    });
  } catch (err) {
    logger.error('[complianceTracker] recordPlatformTOSCheck failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/** Mark a compliance record as verified (e.g., after human review). */
export async function verifyRecord(recordId: string): Promise<void> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    await db
      .prepare(`UPDATE compliance_metadata SET verified = 1, verified_at = ?1 WHERE id = ?2`)
      .bind(nowSec(), recordId)
      .run();
  } catch (err) {
    logger.error('[complianceTracker] verifyRecord failed', { error: getErrorMessage(err), recordId });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Aggregate compliance statistics for a user, optionally bounded by date range. */
export async function getComplianceReport(
  userId: string,
  opts?: { fromDate?: number; toDate?: number }
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
 * Returns false when any unverified row exists, or when no rows exist at all.
 */
export async function isCompliant(executionId: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) as verified_count
       FROM compliance_metadata WHERE execution_id = ?1`
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
