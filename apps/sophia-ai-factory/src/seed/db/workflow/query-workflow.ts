/**
 * Workflow Queries and Status Mutations
 * Layer: SEED (Foundational Primitives)
 */

import type { WorkflowRow, StepMissionRow, WorkflowWithSteps } from './types';
import { getD1 } from './d1-binding';

/** Fetch a single workflow + ordered step missions. Returns null if not found or wrong org. */
export async function getWorkflow(
  id: string,
  orgId: string,
): Promise<WorkflowWithSteps | null> {
  const db = await getD1();

  const wf = await db
    .prepare('SELECT * FROM workflows WHERE id=? AND org_id=?')
    .bind(id, orgId)
    .first<WorkflowRow>();

  if (!wf) return null;

  const { results } = await db
    .prepare(
      `SELECT id, org_id, parent_mission_id, status, params,
       result, error_message, started_at, completed_at, created_at
       FROM missions WHERE parent_mission_id=? AND org_id=?
       ORDER BY CAST(json_extract(params,'$.step_order') AS INTEGER) ASC`,
    )
    .bind(id, orgId)
    .all<StepMissionRow>();

  return { ...wf, steps: results ?? [] };
}

/** List most-recent workflows for an org (newest first). */
export async function listWorkflows(
  orgId: string,
  limit = 20,
): Promise<WorkflowRow[]> {
  const db = await getD1();
  const cap = Math.min(limit, 100);

  const { results } = await db
    .prepare(
      `SELECT id, org_id, prompt, status, final_result, error_message, created_at, updated_at
       FROM workflows WHERE org_id=? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(orgId, cap)
    .all<WorkflowRow>();

  return results ?? [] as WorkflowRow[];
}

/** Update workflow status + optional final_result. Used by cron stepper. */
export async function markWorkflowStatus(
  id: string,
  status: WorkflowRow['status'],
  finalResult?: string | null,
): Promise<void> {
  const db = await getD1();
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE workflows SET status=?, final_result=?, updated_at=? WHERE id=?`,
    )
    .bind(status, finalResult ?? null, now, id)
    .run();
}
