/**
 * Workflow Stepper Cron — Phase 03 Supervisor Agent
 *
 * Schedule: every 1 min → advances queued/running workflows one step at a time.
 * Idempotent: all UPDATEs gated by WHERE status=<expected>.
 * Per-workflow try/catch: one bad workflow never kills the batch.
 */

import { NextRequest, NextResponse } from 'next/server'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { logger } from '@/lib/utils/logger-utility'
import { computeNext } from '@/lib/workflows/compute-next'
import { recordLlmCall } from '@/lib/telemetry/llm-trace'
import { route as routeLlm } from '@/lib/ai/llm-router'
import { callWithCache } from '@/lib/llm/cache/call-with-cache'
import { callAnthropic } from '@/lib/ai/anthropic-adapter'
import { resolveOrgOwnerUserId } from '@/lib/auth/resolve-org-id'
import { resolveUserApiKey } from '@/lib/byok/resolve-user-api-key'
import type { CacheKey, CacheEntry } from '@/lib/llm/cache/llm-cache'
import type { WorkflowRow, StepMissionRow } from '@/lib/db/workflow-repository'

export const dynamic = 'force-dynamic'

// ── OpenRouter response interface ─────────────────────────────────────────────

interface OpenRouterChoice {
  message: {
    role:    string
    content: string
  }
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[]
  usage?: {
    prompt_tokens?:     number
    completion_tokens?: number
  }
}

// ── D1 binding helper (matches local-mode-health pattern) ─────────────────────

function getDb(): D1Database {
  const env = (globalThis as Record<string, unknown>).__env as Record<string, unknown> | undefined
  const db = env?.DB as D1Database | undefined
  if (!db) throw new Error('D1 binding not available')
  return db
}

// ── Auth: internal-only (same pattern as local-mode-health) ──────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true  // dev: allow if no secret configured
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── LLM gate check ────────────────────────────────────────────────────────────

function isRealLlmEnabled(): boolean {
  return (
    process.env.WORKFLOW_REAL_LLM_ENABLED === '1' &&
    Boolean(process.env.OPENROUTER_API_KEY)
  )
}

// Providers supported by the live fetch path.
// Phase 4J: 'anthropic' added — handled via callAnthropic adapter (ANTHROPIC_API_KEY required).
const REAL_LLM_PROVIDERS: ReadonlySet<string> = new Set(['openrouter', 'local-mekongd', 'anthropic'])

// ── Step executor ─────────────────────────────────────────────────────────────

export async function executeStep(
  db: D1Database,
  workflow: WorkflowRow,
  missionId: string,
  stepOrder: number,
  stepType: string,
): Promise<void> {
  const now = new Date().toISOString()
  const startedAt = Date.now()

  // Phase 4C: Smart LLM Router — classify prompt complexity + pick cloud tier.
  // BYOK local-mekongd preference deferred: workflows.org_id refs organizations(id),
  // not users(id). Future slice: join org_members or denormalize created_by_user_id,
  // then pass hasLocalMode=true when resolveLocalMekongdForUser() returns a config.
  const decision = routeLlm(workflow.prompt, false)

  // Phase 4G: dark-launched real LLM call via callWithCache + OpenRouter.
  // Falls back to mock string when gate disabled or live fetch fails.
  // Rationale: swallowing live errors keeps the dark-launch safe — workflows
  // still make progress; operators can inspect logs to validate LLM quality
  // before enabling WORKFLOW_REAL_LLM_ENABLED=1 in production.
  let result: string
  // Track whether live LLM succeeded. Flipped to true on any failure/skip path
  // so success-path recordLlmCall telemetry is honest during dark-launch.
  let llmDegraded = false

  if (isRealLlmEnabled()) {
    const { provider, model } = decision

    // Gate live fetch to supported providers. Unknown/stub → skip + warn operator.
    if (!REAL_LLM_PROVIDERS.has(provider)) {
      llmDegraded = true
      logger.warn('[workflow-stepper] unsupported LLM provider, skipping live fetch', {
        event:    'llm_router_unsupported',
        provider,
        model,
        workflowId: workflow.id,
      })
      result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
    } else if (provider === 'anthropic') {
      // Phase 4J: Anthropic native adapter path.
      // Phase 4G-WIRE: BYOK — prefer the workflow owner's stored key when
      // BYOK is enabled; otherwise fall back to `ANTHROPIC_API_KEY` env.
      const ownerUserId = await resolveOrgOwnerUserId(workflow.org_id)
      const anthropicKey = await resolveUserApiKey(
        ownerUserId,
        'anthropic',
        process.env.ANTHROPIC_API_KEY,
      )
      if (!anthropicKey) {
        llmDegraded = true
        logger.warn('[workflow-stepper] ANTHROPIC_API_KEY not set, falling back to mock', {
          event:      'llm_anthropic_missing_key',
          workflowId: workflow.id,
          model,
        })
        result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
      } else {
        const cacheKey: CacheKey = {
          provider: 'anthropic',
          model,
          messages: [
            { role: 'user', content: workflow.prompt },
          ],
          orgId: workflow.org_id || 'system',
        }

        try {
          const cacheResult = await callWithCache(cacheKey, async (): Promise<CacheEntry> => {
            const text = await callAnthropic({
              model,
              messages: [{ role: 'user', content: workflow.prompt }],
              apiKey:   anthropicKey,
            })
            return { response: text }
          })

          if (cacheResult.response) {
            result = cacheResult.response
          } else {
            llmDegraded = true
            logger.warn('[workflow-stepper] empty LLM response, falling back to mock', {
              event:      'llm_empty_response',
              workflowId: workflow.id,
              model,
            })
            result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
          }
        } catch (err) {
          llmDegraded = true
          logger.warn('[workflow-stepper] live LLM call failed, falling back to mock', {
            workflowId: workflow.id,
            model,
            err,
          })
          result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
        }
      }
    } else {
      const cacheKey: CacheKey = {
        // local-mekongd → use openrouter endpoint during dark-launch
        provider: provider === 'local-mekongd' ? 'openrouter' : provider,
        model,
        messages: [
          { role: 'system', content: `You are a workflow step executor for step type: ${stepType}` },
          { role: 'user',   content: workflow.prompt },
        ],
        orgId: workflow.org_id || 'system',
      }

      // Phase 4G-WIRE: BYOK — resolve the workflow owner's key with env fallback.
      const ownerUserId     = await resolveOrgOwnerUserId(workflow.org_id)
      const openrouterKey   = await resolveUserApiKey(
        ownerUserId,
        'openrouter',
        process.env.OPENROUTER_API_KEY,
      )

      try {
        const cacheResult = await callWithCache(cacheKey, async (): Promise<CacheEntry> => {
          const apiKey = openrouterKey ?? ''
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              model,
              messages: cacheKey.messages,
            }),
          })

          if (!response.ok) {
            throw new Error(`OpenRouter ${response.status}: ${await response.text()}`)
          }

          const data = await response.json() as OpenRouterResponse
          const content = data.choices[0]?.message?.content ?? ''

          return {
            response:     content,
            inputTokens:  data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          }
        })

        if (cacheResult.response) {
          result = cacheResult.response
        } else {
          // Empty response from LLM likely indicates upstream issue — treat as degraded.
          llmDegraded = true
          logger.warn('[workflow-stepper] empty LLM response, falling back to mock', {
            event:      'llm_empty_response',
            workflowId: workflow.id,
            model,
          })
          result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
        }
      } catch (err) {
        // Dark-launch safety: swallow live errors, fall back to mock string.
        // Never propagate — workflow must keep making progress during gate testing.
        llmDegraded = true
        logger.warn('[workflow-stepper] live LLM call failed, falling back to mock', {
          workflowId: workflow.id,
          model,
          err,
        })
        result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
      }
    }
  } else {
    result = `Step ${stepType} completed: ${workflow.prompt.slice(0, 100)}`
  }

  try {
    // Flip workflow to 'running' if still 'queued' (first step)
    if (workflow.status === 'queued') {
      await db
        .prepare(`UPDATE workflows SET status='running', updated_at=? WHERE id=? AND status='queued'`)
        .bind(now, workflow.id)
        .run()
    }

    // Mark mission running + write started_at (CAS guard on status='queued')
    const runRes = await db
      .prepare(`UPDATE missions SET status='running', started_at=?, updated_at=? WHERE id=? AND status='queued'`)
      .bind(now, now, missionId)
      .run()

    if (runRes.meta.changes === 0) return  // another tick already advanced this mission

    // Complete mission + write completed_at
    const doneRes = await db
      .prepare(
        `UPDATE missions SET status='completed', result=?, completed_at=?, updated_at=? WHERE id=? AND status='running'`,
      )
      .bind(result, now, now, missionId)
      .run()

    if (doneRes.meta.changes === 0) return  // raced — another worker completed it

    // actor=workflow.id, source:'cron' (Phase F pattern). org_id passed as userId param.
    track(D1Events.WORKFLOW_STEP_COMPLETED, workflow.id, {
      workflow_id: workflow.id,
      step_order: stepOrder,
      step_type: stepType,
      source: 'cron',
    }, workflow.org_id)

    // Phase 4B+4C+4G-FIX: emit LLM call trace with honest ok flag.
    // llmDegraded=true when live call was skipped (unsupported provider),
    // returned empty, or threw — so dashboards correctly show fallback-to-mock.
    recordLlmCall(
      {
        workflowId:  workflow.id,
        stepOrder,
        stepType,
        provider:    decision.provider,
        model:       decision.model,
        durationMs:  Date.now() - startedAt,
        ok:          !llmDegraded,
        errorClass:  llmDegraded ? 'LLM_LIVE_FAILED_FALLBACK' : undefined,
      },
      workflow.id,
      workflow.org_id,
    )
  } catch (err) {
    // Fail-fast: mark mission failed + propagate to workflow
    const msg = err instanceof Error ? err.message : String(err)
    await db
      .prepare(`UPDATE missions SET status='failed', error_message=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(msg.slice(0, 500), now, missionId)
      .run()
    await db
      .prepare(`UPDATE workflows SET status='failed', final_result=?, updated_at=? WHERE id=? AND status IN ('queued','running')`)
      .bind(`Step ${stepType} failed: ${msg.slice(0, 200)}`, now, workflow.id)
      .run()
    track(D1Events.WORKFLOW_FAILED, workflow.id, {
      workflow_id: workflow.id,
      error_class: msg.slice(0, 200),
      source: 'cron',
    }, workflow.org_id)

    // Phase 4B+4C: emit failed LLM trace with router-selected provider/model
    recordLlmCall(
      {
        workflowId:  workflow.id,
        stepOrder,
        stepType,
        provider:    decision.provider,
        model:       decision.model,
        durationMs:  Date.now() - startedAt,
        ok:          false,
        errorClass:  msg.slice(0, 200),
      },
      workflow.id,
      workflow.org_id,
    )
    throw err  // rethrow so advanceOne outer catch logs it
  }
}

// ── advanceOne — apply a single transition for one workflow ───────────────────

interface ActionRecord { workflowId: string; action: string }

async function advanceOne(db: D1Database, workflow: WorkflowRow): Promise<ActionRecord> {
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
      // No event emit for unblock — not a user-visible transition
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
      // H4: emit event only if CAS actually transitioned
      if (res.meta.changes > 0) {
        track(D1Events.WORKFLOW_COMPLETED, workflow.id, {
          workflow_id: workflow.id,
          source: 'cron',
        }, workflow.org_id)
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
          workflow_id: workflow.id,
          error_class: next.reason,
          source: 'cron',
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

// ── GET handler (CF cron invokes GET) ─────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let db: D1Database
  try {
    db = getDb()
  } catch {
    return NextResponse.json({ error: 'D1 unavailable' }, { status: 500 })
  }

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
      const record = await advanceOne(db, wf)
      actions.push(record)
    } catch (err) {
      logger.warn('[workflow-stepper] advanceOne failed', { workflowId: wf.id, err })
      actions.push({ workflowId: wf.id, action: 'error' })
    }
  }

  return NextResponse.json({ processed: active.length, actions })
}
