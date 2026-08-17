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

const VALID_TRANSITIONS: Record<DistributionPlan['status'], DistributionPlan['status'][]> = {
  draft: ['scheduled', 'publishing', 'failed'],
  scheduled: ['publishing', 'failed'],
  publishing: ['published', 'failed'],
  published: ['failed'],
  failed: ['draft'],
};

export function isValidPlanTransition(
  from: DistributionPlan['status'],
  to: DistributionPlan['status'],
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}


export async function createDistributionPlan(
  plan: Omit<DistributionPlan, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DistributionPlan> {
  const db = getD1();
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
  const db = getD1();
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
  const db = getD1();
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

export async function updateDistributionPlanStatus(
  id: string,
  status: DistributionPlan['status'],
  workspaceId: string,
): Promise<DistributionPlan> {
  const db = getD1();
  if (!db) throw new DistributionError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);

  const current = await db
    .prepare(`SELECT * FROM distribution_plans WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionPlanRow>();

  if (!current) {
    throw new DistributionError('NOT_FOUND', `Plan ${id} not found`);
  }

  if (!isValidPlanTransition(current.status as DistributionPlan['status'], status)) {
    throw new DistributionError(
      'INVALID_TRANSITION',
      `Cannot transition plan ${id} from ${current.status} to ${status}`,
    );
  }

  await db
    .prepare(
      `UPDATE distribution_plans
       SET status = ?1, updated_at = ?2
       WHERE id = ?3 AND workspace_id = ?4`,
    )
    .bind(status as DistributionPlan['status'], now, id, workspaceId)
    .run();

  const updated = await db
    .prepare(`SELECT * FROM distribution_plans WHERE id = ?1 AND workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<DistributionPlanRow>();

  if (!updated) {
    throw new DistributionError('NOT_FOUND', `Plan ${id} not found`);
  }

  return planRowToDomain(updated as DistributionPlanRow);
}


