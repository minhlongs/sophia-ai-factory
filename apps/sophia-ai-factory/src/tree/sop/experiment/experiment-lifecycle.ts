import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ExperimentVariant, SopExperiment } from './types';
import { rowToExperiment } from './hash-utils';

/** Insert a new experiment and return its generated ID. */
export async function createExperiment(params: {
  sopTemplateId: string;
  parameterKey: string;
  variants: ExperimentVariant[];
  trafficPct?: number;
  createdBy: string;
}): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const trafficPct = params.trafficPct ?? 100;

  try {
    await db
      .prepare(
        `INSERT INTO sop_experiments
         (id, sop_template_id, parameter_key, variants_json, traffic_pct, status, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'draft', ?6, ?7)`,
      )
      .bind(id, params.sopTemplateId, params.parameterKey, JSON.stringify(params.variants), trafficPct, params.createdBy, now)
      .run();
  } catch (err) {
    logger.error('[createExperiment] Insert failed', { error: getErrorMessage(err) });
    throw err;
  }

  return id;
}

/** Fetch all active experiments for a given SOP template. */
export async function getActiveExperiments(sopTemplateId: string): Promise<SopExperiment[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  try {
    const { results } = await db
      .prepare(
        `SELECT * FROM sop_experiments WHERE sop_template_id = ?1 AND status = 'active'`,
      )
      .bind(sopTemplateId)
      .all();
    return (results as Record<string, unknown>[]).map(rowToExperiment);
  } catch (err) {
    logger.error('[getActiveExperiments] Query failed', { error: getErrorMessage(err) });
    throw err;
  }
}
