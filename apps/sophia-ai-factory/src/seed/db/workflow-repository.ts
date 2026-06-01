/**
 * Workflow Repository — D1 queries for Supervisor Agent workflows
 *
 * Uses raw D1Database (batch API) for atomic multi-row inserts.
 * All queries are org_id-scoped to prevent cross-tenant leakage.
 */

import { SUPERVISOR_STEPS } from '@/land/workflows/supervisor-steps'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowRow {
  id: string
  org_id: string
  prompt: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  final_result: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface StepMissionRow {
  id: string
  org_id: string
  parent_mission_id: string
  status: string
  params: string   // JSON: {step_order, step_type, workflow_id}
  result?: string | null
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
}

export interface WorkflowWithSteps extends WorkflowRow {
  steps: StepMissionRow[]
}

// ── D1 binding helper ─────────────────────────────────────────────────────────

function getD1(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  if (env?.DB) return env.DB as D1Database

  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Database

  const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  if (globalDb) return globalDb

  throw new Error('[workflow-repository] D1 binding not available')
}

/** Generate a 16-byte hex id (SQLite-compatible) */
function newId(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── createWorkflow ────────────────────────────────────────────────────────────

/**
 * Atomically insert 1 workflow + 3 step missions via D1 batch().
 * Step 1 → status='queued', steps 2+3 → status='blocked'.
 */
export async function createWorkflow(
  orgId: string,
  prompt: string,
): Promise<WorkflowWithSteps> {
  const db = getD1()
  const workflowId = newId()
  const now = new Date().toISOString()

  const stepIds = [newId(), newId(), newId()]

  const wfInsert = db.prepare(
    `INSERT INTO workflows (id, org_id, prompt, status, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?)`,
  ).bind(workflowId, orgId, prompt, now, now)

  const missionInserts = SUPERVISOR_STEPS.map((step, i) => {
    const missionId = stepIds[i]
    const status = step.order === 1 ? 'queued' : 'blocked'
    const params = JSON.stringify({
      step_order: step.order,
      step_type:  step.type,
      workflow_id: workflowId,
    })
    return db.prepare(
      `INSERT INTO missions
         (id, org_id, title, command, params, status, parent_mission_id,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      missionId,
      orgId,
      `Step ${step.order}: ${step.type}`,
      step.command,
      params,
      status,
      workflowId,
      now,
      now,
    )
  })

  await db.batch([wfInsert, ...missionInserts])

  return {
    id: workflowId,
    org_id: orgId,
    prompt,
    status: 'queued',
    final_result: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    steps: SUPERVISOR_STEPS.map((step, i) => ({
      id: stepIds[i],
      org_id: orgId,
      parent_mission_id: workflowId,
      status: step.order === 1 ? 'queued' : 'blocked',
      params: JSON.stringify({
        step_order: step.order,
        step_type: step.type,
        workflow_id: workflowId,
      }),
      result: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: now,
    })),
  }
}

// ── getWorkflow ───────────────────────────────────────────────────────────────

/** Fetch a single workflow + ordered step missions. Returns null if not found or wrong org. */
export async function getWorkflow(
  id: string,
  orgId: string,
): Promise<WorkflowWithSteps | null> {
  const db = getD1()

  const wf = await db
    .prepare('SELECT * FROM workflows WHERE id=? AND org_id=?')
    .bind(id, orgId)
    .first<WorkflowRow>()

  if (!wf) return null

  const { results } = await db
    .prepare(
      `SELECT id, org_id, parent_mission_id, status, params,
              result, error_message, started_at, completed_at, created_at
       FROM missions WHERE parent_mission_id=? AND org_id=?
       ORDER BY CAST(json_extract(params,'$.step_order') AS INTEGER) ASC`,
    )
    .bind(id, orgId)
    .all<StepMissionRow>()

  return { ...wf, steps: results ?? [] }
}

// ── listWorkflows ─────────────────────────────────────────────────────────────

/** List most-recent workflows for an org (newest first). */
export async function listWorkflows(
  orgId: string,
  limit = 20,
): Promise<WorkflowRow[]> {
  const db = getD1()
  const cap = Math.min(limit, 100)

  const { results } = await db
    .prepare(
      `SELECT id, org_id, prompt, status, final_result, error_message, created_at, updated_at
       FROM workflows WHERE org_id=? ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(orgId, cap)
    .all<WorkflowRow>()

  return results ?? []
}

// ── markWorkflowStatus ────────────────────────────────────────────────────────

/** Update workflow status + optional final_result. Used by cron stepper. */
export async function markWorkflowStatus(
  id: string,
  status: WorkflowRow['status'],
  finalResult?: string | null,
): Promise<void> {
  const db = getD1()
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE workflows SET status=?, final_result=?, updated_at=? WHERE id=?`,
    )
    .bind(status, finalResult ?? null, now, id)
    .run()
}
