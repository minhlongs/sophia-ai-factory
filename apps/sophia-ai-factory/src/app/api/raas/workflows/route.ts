/**
 * POST /api/raas/workflows — create a 3-step supervisor workflow
 * GET  /api/raas/workflows — list workflows for authenticated org (newest first)
 *
 * Auth: getCurrentUser() (Better Auth session required)
 * Input: Zod-validated. No :any types.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/better-auth-session'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { createWorkflow, listWorkflows } from '@/lib/db/workflow-repository'
import { detectInjection } from '@/lib/security/prompt-guard'
import { logger } from '@/lib/utils/logger-utility'

export const dynamic = 'force-dynamic'

// ── Schema ────────────────────────────────────────────────────────────────────

const CreateWorkflowSchema = z.object({
  prompt: z.string().trim().min(10, 'Prompt must be at least 10 characters').max(2000),
})

// ── D1 raw helper — resolve org_id from org_members ──────────────────────────

function getD1Raw(): D1Database {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
  if (env?.DB) return env.DB as D1Database
  const ctxSymbol = Symbol.for('__cloudflare-context__')
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[ctxSymbol]
  if (ctx?.env?.DB) return ctx.env.DB as D1Database
  const g = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined
  if (g) return g
  throw new Error('D1 binding not available')
}

async function resolveOrgId(userId: string): Promise<string | null> {
  try {
    const db = getD1Raw()
    const row = await db
      .prepare('SELECT org_id FROM org_members WHERE user_id=? LIMIT 1')
      .bind(userId)
      .first<{ org_id: string }>()
    return row?.org_id ?? null
  } catch {
    return null
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const parsed = CreateWorkflowSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_input', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const orgId = await resolveOrgId(user.id)
    if (!orgId) {
      return NextResponse.json({ error: 'org_not_found' }, { status: 422 })
    }

    // Phase 4A: Prompt injection guard at LLM ingress
    const guard = detectInjection(parsed.data.prompt)
    if (guard.flagged) {
      const eventProps = {
        severity:      guard.severity,
        reasons:       guard.reasons,
        prompt_length: parsed.data.prompt.length,
        blocked:       guard.severity === 'high',
        endpoint:      'POST /api/raas/workflows',
      }
      track(D1Events.PROMPT_INJECTION_DETECTED, user.id, eventProps, orgId)
      if (guard.severity === 'high') {
        return NextResponse.json(
          {
            error:    'prompt_injection_detected',
            severity: guard.severity,
            reasons:  guard.reasons,
          },
          { status: 400 },
        )
      }
      // medium → proceed, already logged
    }

    const workflow = await createWorkflow(orgId, parsed.data.prompt)

    // Fire-and-forget signal — never blocks response
    track(D1Events.WORKFLOW_STARTED, user.id, {
      workflow_id: workflow.id,
      org_id:      orgId,
      step_count:  workflow.steps.length,
    }, orgId)

    return NextResponse.json(
      {
        workflow_id: workflow.id,
        status:      workflow.status,
        prompt:      workflow.prompt,
        created_at:  workflow.created_at,
        steps: workflow.steps.map(s => ({
          id:         s.id,
          status:     s.status,
          params:     JSON.parse(s.params) as Record<string, unknown>,
        })),
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error('[POST /api/raas/workflows]', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const orgId = await resolveOrgId(user.id)
    if (!orgId) {
      return NextResponse.json({ workflows: [] }, { status: 200 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    const workflows = await listWorkflows(orgId, limit)

    return NextResponse.json({ workflows }, { status: 200 })
  } catch (err) {
    logger.error('[GET /api/raas/workflows]', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
