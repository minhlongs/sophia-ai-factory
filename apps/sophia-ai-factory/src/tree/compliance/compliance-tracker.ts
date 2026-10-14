/**
 * Compliance Tracker — domain logic for recording and querying compliance metadata.
 *
 * Writes to the `compliance_metadata` D1 table introduced in migration 0137.
 * All queries use parameterized statements (no string interpolation).
 *
 * @module tree/compliance/compliance-tracker
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AIDisclosure, C2PAMetadata, Platform } from '@/seed/types/compliance';
import { insertComplianceRecord, nowSec } from './compliance-tracker-helpers';
import {
  getComplianceReport,
  isCompliant,
  getRecordsForExecution,
} from './compliance-tracker-queries';

export { getComplianceReport, isCompliant, getRecordsForExecution };

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
