/**
 * Distribution Plan Status Transitions — State machine and status update D1 mutation.
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/distribution/plan-transitions
 */

import { getD1 } from '@/seed/db/client';
import type { DistributionPlan } from '@/seed/types/creative-domain';
import { DistributionError } from './errors';
import { planRowToDomain, type DistributionPlanRow } from './types';

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

export async function updateDistributionPlanStatus(
  id: string,
  status: DistributionPlan['status'],
  workspaceId: string,
): Promise<DistributionPlan> {
  const db = await getD1();
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
