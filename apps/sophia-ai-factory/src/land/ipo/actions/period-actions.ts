/**
 * IPO Filing Period Lifecycle & Prospectus Generation Actions
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/period-actions
 */

'use server';

import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type IpoFilingPeriod,
  type S1ProspectusDocument,
  type CreateIpoPeriodInput,
  type IpoFilingPeriodRow,
  mapRowToIpoFilingPeriod,
} from '@/seed/types/ipo-filing';
import { generateS1ProspectusPackage } from '@/tree/ipo/s1-prospectus-engine';
import {
  type ActionResult,
  assertIpoAdminAccess,
  resolveDb,
  normalizeErrorArg,
} from './common';
import { insertIpoFilingPeriodRow } from './period-persistence';

/**
 * Creates a new SEC Form S-1 / F-1 filing period.
 */
export async function createIpoFilingPeriodAction(
  input: CreateIpoPeriodInput,
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const period = await insertIpoFilingPeriodRow(db, input);
    if (!period) {
      return failure({ code: 'CREATION_FAILED', message: 'Filing period was not found after insertion.' });
    }
    return success(period);
  } catch (err) {
    logger.error('Failed to create IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Database insertion error: ${String(err)}` });
  }
}

/**
 * Retrieves an IPO filing period by period key.
 */
export async function getIpoFilingPeriodAction(
  periodKey: string,
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const row = await db
      .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
      .bind(periodKey)
      .first<IpoFilingPeriodRow>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Filing period '${periodKey}' does not exist.` });
    }

    return success(mapRowToIpoFilingPeriod(row));
  } catch (err) {
    logger.error('Failed to query IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}

/**
 * Generates an end-to-end Form S-1 / F-1 Prospectus document package.
 */
export async function generateS1ProspectusPackageAction(
  periodKey: string,
): Promise<ActionResult<S1ProspectusDocument>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const doc = await generateS1ProspectusPackage(db, periodKey);
    return success(doc);
  } catch (err) {
    logger.error('Failed to generate S-1 prospectus package', normalizeErrorArg(err));
    return failure({ code: 'PROSPECTUS_ERROR', message: `Prospectus engine failure: ${String(err)}` });
  }
}
