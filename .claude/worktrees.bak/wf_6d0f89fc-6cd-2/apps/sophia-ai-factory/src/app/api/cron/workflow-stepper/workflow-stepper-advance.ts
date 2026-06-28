import { track } from '@/tree/signals/track'
import { D1Events } from '@/tree/signals/d1-event-types'
import { computeNext } from '@/land/workflows/compute-next'
import type { WorkflowRow, StepMissionRow } from '@/seed/db/workflow-repository'

export interface ActionRecord {
  workflowId: string
  action: string
}

type ExecuteStepFn = (
  db: D1Database,
  workflow: WorkflowRow,
  missionId: string,
  stepOrder: number,
  stepType: string,
) => Promise<void>

/**
 * Apply a single transition for one workflow.
 * Uses CAS guards on all UPDATEs to ensure idempotent progress.
 */
export async function advanceOne(
  db: D1Database,
  workflow: WorkflowRow,
  executeStep: ExecuteStepFn,
): Promise<ActionRecord> {
  const { results } = await db
    .prepare(
      `SELECT id, org_id, parent_mission_id, status, params,
              result, error_message, started_at, completed_at, created_at
       FROM missions WHERE parent_mission_id=?
       ORDER BY CAST(json_extract(params,'$.step_order') AS INTEGER) ASC`,
    )
    .bind(workflow.id)
    .all<StepMissionRow>()

  const missions = results ?? []
  const next = computeNext(workflow, missions)
  const now = new Date().toISOString()

  switch (next.action) {
    case 'unblock': {
      await db
        .prepare(`UPDATE missions SET status='queued', updated_at=? WHERE id=? AND status='blocked'`)
        .bind(now, next.nextMissionId)
        .run()
      break
    }

    case 'execute': {
      const mission = missions.find(m => m.id === next.nextMissionId)
      if (!mission) break
      const params = JSON.parse(mission.params) as { step_order: number; step_type: string }
      await executeStep(db, workflow, mission.id, params.step_order, params.step_type)
      break
    }

    case 'complete': {
      const lastCompleted = [...missions]
        .filter(m => m.status === 'completed')
        .sort((a, b) => {
          const ao = (JSON.parse(a.params) as { step_order: number }).step_order
          const bo = (JSON.parse(b.params) as { step_order: number }).step_order
          return bo - ao
        })[0]
      const finalResult = lastCompleted
        ? `Workflow completed — last step: ${(JSON.parse(lastCompleted.params) as { step_type: string }).step_type}`
        : 'Workflow completed'
      const res = await db
        .prepare(
          `UPDATE workflows SET status='completed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`,
        )
        .bind(finalResult, now, workflow.id)
        .run()
      if (res.meta.changes > 0) {
        track(D1Events.WORKFLOW_COMPLETED, workflow.id, { workflow_id: workflow.id, source: 'cron' }, workflow.org_id)
      }
      break
    }

    case 'fail': {
      const res = await db
        .prepare(
          `UPDATE workflows SET status='failed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`,
        )
        .bind(next.reason, now, workflow.id)
        .run()
      if (res.meta.changes > 0) {
        track(D1Events.WORKFLOW_FAILED, workflow.id, {
          workflow_id: workflow.id, error_class: next.reason, source: 'cron',
        }, workflow.org_id)
      }
      break
    }

    case 'none':
    default:
      break
  }

  return { workflowId: workflow.id, action: next.action }
}
