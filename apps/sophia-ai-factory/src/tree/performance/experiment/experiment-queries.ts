/**
 * Experiment Read & Listing Queries
 *
 * @module tree/performance/experiment/experiment-queries
 */

import { getD1 } from '@/seed/db/client';
import type { Experiment, ExperimentStatus } from '@/seed/types/creative-domain';
import { PerformanceError } from '../errors';
import type { ExperimentRow, VariantRow } from './types';
import {
  experimentRowToDomain,
  variantRowToDomain,
} from './variant-allocator';

export async function getExperiment(id: string): Promise<Experiment> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const expRow = await db
    .prepare('SELECT * FROM experiments WHERE id = ?1')
    .bind(id)
    .first<ExperimentRow>();

  if (!expRow) throw new PerformanceError('NOT_FOUND', `Experiment ${id} not found`);

  const varResult = await db
    .prepare('SELECT * FROM experiment_variants WHERE experiment_id = ?1')
    .bind(id)
    .all<VariantRow>();

  const variants = (varResult.results ?? []).map(variantRowToDomain);
  return experimentRowToDomain(expRow, variants);
}

export async function listExperiments(
  workspaceId: string,
  opts?: { projectId?: string; status?: ExperimentStatus },
): Promise<Experiment[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?1'];
  const params: unknown[] = [workspaceId];
  let idx = 2;

  if (opts?.projectId) {
    conditions.push(`project_id = ?${idx}`);
    params.push(opts.projectId);
    idx++;
  }
  if (opts?.status) {
    conditions.push(`status = ?${idx}`);
    params.push(opts.status);
    idx++;
  }

  const where = conditions.join(' AND ');
  const result = await db
    .prepare(`SELECT * FROM experiments WHERE ${where} ORDER BY created_at DESC`)
    .bind(...params)
    .all<ExperimentRow>();

  return (result.results ?? []).map((row) => experimentRowToDomain(row));
}
