/**
 * Distribution Plan CRUD — D1 repository.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/plans
 */

import { getD1 } from '@/seed/db/client';
import type { DistributionPlan } from '@/seed/types/creative-domain';
import { DistributionError } from './errors';
import {
  newDistributionPlanId,
  planRowToDomain,
  planDomainToRow,
  type DistributionPlanRow,
} from './types';

export {
  isValidPlanTransition,
  updateDistributionPlanStatus,
} from './plan-transitions';

export async function createDistributionPlan(
  plan: Omit<DistributionPlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DistributionPlan> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const id = newDistributionPlanId();
  const now = Math.floor(Date.now() / 1000);
  const row = planDomainToRow({ ...plan, id, createdAt: now, updatedAt: now });

  try {
    await db
      .prepare(
        `INSERT INTO distribution_plans
         (id, workspace_id, project_id, channels, schedule_at, status,
          created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        id,
        row.workspace_id,
        row.project_id,
        row.channels,
        row.schedule_at,
        row.status,
        row.created_at,
        row.updated_at,
      )
      .run();
  } catch (err) {
    throw new DistributionError(
      'INSERT_FAILED',
      err instanceof Error ? err.message : 'unknown',
    );
  }

  return planRowToDomain({ ...row, id, created_at: now, updated_at: now });
}

export async function getDistributionPlan(
  id: string,
  workspaceId: string,
): Promise<DistributionPlan> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(`SELECT * FROM distribution_plans WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionPlanRow>();

  if (!row) {
    throw new DistributionError('NOT_FOUND', `Plan ${id} not found`);
  }

  return planRowToDomain(row);
}

export async function listDistributionPlans(
  workspaceId: string,
  status?: DistributionPlan['status'],
): Promise<DistributionPlan[]> {
  const db = await getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  let query = 'SELECT * FROM distribution_plans WHERE workspace_id = ?1';
  const params: unknown[] = [workspaceId];

  if (status) {
    query += ' AND status = ?2';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const result = await db.prepare(query).bind(...params).all<DistributionPlanRow>();
  return (result.results ?? []).map(planRowToDomain);
}
