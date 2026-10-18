/**
 * ASC 830 Multi-Entity CTA Consolidation Actions
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/consolidation-actions
 */

'use server';

import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type MultiEntityConsolidation,
  type MultiEntityConsolidationResult,
  type ConsolidateCtaInput,
  type MultiEntityConsolidationRow,
  mapRowToMultiEntityConsolidation,
} from '@/seed/types/ipo-filing';
import { consolidateMultiEntityCta } from '@/tree/ipo/s1-prospectus-engine';
import {
  type ActionResult,
  assertIpoAdminAccess,
  resolveDb,
  normalizeErrorArg,
} from './common';
import { persistConsolidationRecord } from './consolidation-persistence';

/**
 * Executes and persists an ASC 830 Multi-Entity CTA consolidation batch.
 */
export async function consolidateMultiEntityCtaAction(
  input: ConsolidateCtaInput
): Promise<ActionResult<MultiEntityConsolidationResult>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const result = await consolidateMultiEntityCta(input.entities, input.periodKey);

    const allRecords = [...result.entities, result.consolidatedGroup];
    for (const rec of allRecords) {
      await persistConsolidationRecord(db, rec);
    }

    return success(result);
  } catch (err) {
    logger.error('Failed to execute multi-entity consolidation', normalizeErrorArg(err));
    return failure({ code: 'CONSOLIDATION_ERROR', message: `Consolidation error: ${String(err)}` });
  }
}

/**
 * Retrieves the historical consolidation batch records for a specific period.
 */
export async function getConsolidationHistoryAction(
  periodKey: string
): Promise<ActionResult<MultiEntityConsolidation[]>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const rows = await db
      .prepare('SELECT * FROM multi_entity_consolidations WHERE period_key = ? ORDER BY created_at DESC')
      .bind(periodKey)
      .all<MultiEntityConsolidationRow>();

    const items = (rows.results || []).map(mapRowToMultiEntityConsolidation);
    return success(items);
  } catch (err) {
    logger.error('Failed to query consolidation history', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}
