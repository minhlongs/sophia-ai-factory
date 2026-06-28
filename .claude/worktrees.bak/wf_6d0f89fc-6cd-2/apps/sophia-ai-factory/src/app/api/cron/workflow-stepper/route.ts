/**
 * Workflow Stepper Cron — Phase 03 Supervisor Agent
 *
 * Schedule: every 1 min → advances queued/running workflows one step at a time.
 * Idempotent: all UPDATEs gated by WHERE status=<expected>.
 * Per-workflow try/catch: one bad workflow never kills the batch.
 *
 * Sub-modules:
 *   workflow-stepper-runtime-utils.ts — getDb, isRealLlmEnabled, REAL_LLM_PROVIDERS, types
 *   workflow-stepper-llm-executor.ts  — callAnthropicWithByok, callOpenRouterWithByok
 *   workflow-stepper-advance.ts       — advanceOne, ActionRecord
 *
 * @module api/cron/workflow-stepper
 */

import { NextRequest, NextResponse } from 'next/server'
import { track } from '@/tree/signals/track'
import { D1Events } from '@/tree/signals/d1-event-types'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { route as routeLlm } from '@/seed/ai/llm-router'
import { recordLlmCall } from '@/seed/observability/telemetry/llm-trace'
import type { WorkflowRow } from '@/seed/db/workflow-repository'
import { getDb, isRealLlmEnabled, REAL_LLM_PROVIDERS } from './workflow-stepper-runtime-utils'
import { callAnthropicWithByok, callOpenRouterWithByok } from './workflow-stepper-llm-executor'
import { advanceOne } from './workflow-stepper-advance'
import type { ActionRecord } from './workflow-stepper-advance'
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker'
import { verifyCronAuth } from '@/seed/security/cron-auth'
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in'

export const dynamic = 'force-dynamic'

const CRON_NAME = 'workflow-stepper'
/** Every 1 min — skip if ran within last 30 seconds */
const IDEMPOTENCY_WINDOW_MS = 30 * 1000

export type { OpenRouterChoice, OpenRouterResponse } from './workflow-stepper-runtime-utils'
export type { LlmCallResult } from './workflow-stepper-llm-executor'
export type { ActionRecord } from './workflow-stepper-advance'

/** Execute a single workflow step: route to LLM, write result to DB, emit telemetry. */
export async function executeStep(
  db: D1Database,
  workflow: WorkflowRow,
  missionId: string,
  stepOrder: number,
  stepType: string,
): Promise<void> {
  const now = new Date().toISOString()
  const startedAt = Date.now()

  const decision = routeLlm(workflow.prompt, false)

  let result: string = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
  let llmDegraded = false
  let degradeReason: 'LLM_MISSING_KEY_FALLBACK' | 'LLM_LIVE_FAILED_FALLBACK' | undefined

  if (isRealLlmEnabled()) {
    const { provider, model } = decision

    if (!REAL_LLM_PROVIDERS.has(provider)) {
      llmDegraded = true
      degradeReason = 'LLM_LIVE_FAILED_FALLBACK'
      logger.warn('[workflow-stepper] unsupported LLM provider, skipping live fetch', {
        event: 'llm_router_unsupported', provider, model, workflowId: workflow.id,
      })
      result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
} else if (provider === 'anthropic') {
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('[workflow-stepper] ANTHROPIC_API_KEY not set, falling back to mock', {
      event: 'llm_anthropic_missing_key',
      provider,
      model,
      workflowId: workflow.id,
    })
    result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
    llmDegraded = true
    degradeReason = 'LLM_MISSING_KEY_FALLBACK'
  } else {
    const llmResult = await callAnthropicWithByok(workflow, model, stepType)
    result = llmResult.result
    llmDegraded = llmResult.llmDegraded
    degradeReason = llmResult.degradeReason
  }
} else if (provider === 'openrouter') {
  const llmResult = await callOpenRouterWithByok(workflow, model, provider, stepType)
  result = llmResult.result
  llmDegraded = llmResult.llmDegraded
  degradeReason = llmResult.degradeReason
}
} else {
  result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
}

  try {
    if (workflow.status === 'queued') {
      await db
        .prepare(`UPDATE workflows SET status='running', updated_at=? WHERE id=? AND status='queued'`)
        .bind(now, workflow.id)
        .run()
    }

    const runRes = await db
      .prepare(`UPDATE missions SET status='running', started_at=?, updated_at=? WHERE id=? AND status='queued'`)
      .bind(now, now, missionId)
      .run()

    if (runRes.meta.changes === 0) return

    const doneRes = await db
      .prepare(
        `UPDATE missions SET status='completed', result=?, completed_at=?, updated_at=? WHERE id=? AND status='running'`,
      )
      .bind(result, now, now, missionId)
      .run()

    if (doneRes.meta.changes === 0) return

    track(D1Events.WORKFLOW_STEP_COMPLETED, workflow.id, {
      workflow_id: workflow.id, step_order: stepOrder, step_type: stepType, source: 'cron',
    }, workflow.org_id)

    recordLlmCall(
      {
        workflowId: workflow.id, stepOrder, stepType,
        provider: decision.provider, model: decision.model,
        durationMs: Date.now() - startedAt,
        ok: !llmDegraded,
        errorClass: llmDegraded ? (degradeReason ?? 'LLM_LIVE_FAILED_FALLBACK') : undefined,
      },
      workflow.id,
      workflow.org_id,
    )
  } catch (err) {
    const msg = getErrorMessage(err)
    await db
      .prepare(`UPDATE missions SET status='failed', error_message=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(msg.slice(0, 500), now, missionId)
      .run()
    await db
      .prepare(`UPDATE workflows SET status='failed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(`Step ${stepType} failed: ${msg.slice(0, 200)}`, now, workflow.id)
      .run()
    track(D1Events.WORKFLOW_FAILED, workflow.id, {
      workflow_id: workflow.id, error_class: msg.slice(0, 200), source: 'cron',
    }, workflow.org_id)
    recordLlmCall(
      {
        workflowId: workflow.id, stepOrder, stepType,
        provider: decision.provider, model: decision.model,
        durationMs: Date.now() - startedAt, ok: false, errorClass: msg.slice(0, 200),
      },
      workflow.id,
      workflow.org_id,
    )
    throw err
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME)

  let db: D1Database
  try {
    db = getDb()
  } catch (err) {
    failCronCheckIn(cronCtx, CRON_NAME, err)
    return NextResponse.json({ error: 'D1 unavailable' }, { status: 500 })
  }

  if (await wasRecentlyRun(db, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME)
    return NextResponse.json({ ok: true, skipped: 'recent_run' })
  }

  try {
    const { results: workflows } = await db
      .prepare(
        `SELECT id, org_id, prompt, status, final_result, error_message, created_at, updated_at
         FROM workflows WHERE status IN ('queued','running') LIMIT 20`,
      )
      .all<WorkflowRow>()

    const active = workflows ?? []
    const actions: ActionRecord[] = []

    for (const wf of active) {
      try {
        // Loop advanceOne to allow parallel steps to execute in the same tick.
        // Each iteration resolves one step (execute/unblock). With depends_on logic,
        // all steps in a parallel group whose deps are met can unblock in sequence
        // within the same tick.
        for (let tick = 0; tick < 8; tick++) {
          const record = await advanceOne(db, wf, executeStep)
          actions.push(record)
          // Stop if no more progress possible (step running, blocked waiting for deps, or done)
          if (record.action !== 'execute' && record.action !== 'unblock') {
            break
          }
        }
      } catch (err) {
        logger.warn('[workflow-stepper] advanceOne failed', { workflowId: wf.id, err })
        actions.push({ workflowId: wf.id, action: 'error' })
      }
    }

    await recordCronRun(db, CRON_NAME, 'success')
    finishCronCheckIn(cronCtx, CRON_NAME)
    return NextResponse.json({ processed: active.length, actions })
  } catch (err) {
    const msg = getErrorMessage(err)
    await recordCronRun(db, CRON_NAME, 'failure', msg)
    failCronCheckIn(cronCtx, CRON_NAME, err)
    throw err
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
