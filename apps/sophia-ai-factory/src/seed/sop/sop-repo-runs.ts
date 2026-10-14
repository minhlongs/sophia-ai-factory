/**
 * SOP Execution Repository
 * CRUD for sop_executions (canonical table — migration 0160).
 */

import type { SopRunRow, UpdateRunFields } from './sop-types';
import {
  nowSec,
  genId,
  resolveInstallationContext,
  incrementSopRunCount,
} from './sop-repo-runs-helpers';

export { incrementSopRunCount };

/**
 * Create a new execution record (status = pending, formerly 'queued').
 * Looks up user_id, org_id, sop_template_id from user_sop_installations.
 */
export async function createRun(
  db: D1Database,
  installationId: string,
  triggerType: SopRunRow['trigger_type'],
): Promise<SopRunRow> {
  const id = genId();
  const ts = nowSec();
  const { userId, orgId, templateId } = await resolveInstallationContext(db, installationId);

  await db
    .prepare(
      `INSERT INTO sop_executions
      (id, user_id, org_id, sop_template_id, installation_id,
       trigger_type, mission_ids, status, result_summary, error_message,
       requires_approval, total_steps, current_step, started_at, completed_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', 'pending', NULL, NULL, 0, 1, 0, ?7, NULL, ?7)`,
    )
    .bind(id, userId, orgId, templateId, installationId, triggerType, ts)
    .run();

  const row = await db
    .prepare(`SELECT * FROM sop_executions WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<SopRunRow>();

  if (!row) throw new Error(`createRun: row not found after insert: ${id}`);

  await incrementSopRunCount(db, installationId);
  return row;
}

/**
 * Update execution status and optional metadata fields.
 */
export async function updateRunStatus(
  db: D1Database,
  runId: string,
  fields: UpdateRunFields,
): Promise<void> {
  const sets: string[] = [];
  const bindings: (string | number | null)[] = [];
  let idx = 1;

  if (fields.status !== undefined) {
    sets.push(`status = ?${idx++}`);
    bindings.push(fields.status);
  }
  if (fields.resultSummary !== undefined) {
    sets.push(`result_summary = ?${idx++}`);
    bindings.push(fields.resultSummary);
  }
  if (fields.errorMessage !== undefined) {
    sets.push(`error_message = ?${idx++}`);
    bindings.push(fields.errorMessage);
  }
  if (fields.requiresApproval !== undefined) {
    sets.push(`requires_approval = ?${idx++}`);
    bindings.push(fields.requiresApproval);
  }
  if (fields.startedAt !== undefined) {
    sets.push(`started_at = ?${idx++}`);
    bindings.push(fields.startedAt);
  }
  if (fields.completedAt !== undefined) {
    sets.push(`completed_at = ?${idx++}`);
    bindings.push(fields.completedAt);
  }

  if (sets.length === 0) return;

  await db
    .prepare(`UPDATE sop_executions SET ${sets.join(', ')} WHERE id = ?${idx}`)
    .bind(...bindings, runId)
    .run();
}

/**
 * Append a mission ID to an execution's mission_ids JSON array.
 */
export async function appendMissionId(
  db: D1Database,
  runId: string,
  missionId: string,
): Promise<void> {
  const row = await db
    .prepare(`SELECT mission_ids FROM sop_executions WHERE id = ?1 LIMIT 1`)
    .bind(runId)
    .first<{ mission_ids: string }>();

  if (!row) return;

  let ids: string[];
  try {
    ids = JSON.parse(row.mission_ids) as string[];
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }

  ids.push(missionId);

  await db
    .prepare(`UPDATE sop_executions SET mission_ids = ?1 WHERE id = ?2`)
    .bind(JSON.stringify(ids), runId)
    .run();
}
