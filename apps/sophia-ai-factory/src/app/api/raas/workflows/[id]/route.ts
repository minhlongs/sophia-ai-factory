/**
 * GET /api/raas/workflows/[id] — fetch single workflow + ordered step missions
 *
 * Auth: getCurrentUser() (Better Auth session required)
 * 404 returned for missing workflow OR wrong org (prevents cross-tenant enumeration).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/better-auth-session'
import { getWorkflow } from '@/lib/db/workflow-repository'
import { logger } from '@/lib/utils/logger-utility'

export const dynamic = 'force-dynamic'

// ── D1 org_id resolver (same pattern as list route) ───────────────────────────

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

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const orgId = await resolveOrgId(user.id)
    if (!orgId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const workflow = await getWorkflow(id, orgId)
    if (!workflow) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        id:            workflow.id,
        org_id:        workflow.org_id,
        prompt:        workflow.prompt,
        status:        workflow.status,
        final_result:  workflow.final_result,
        error_message: workflow.error_message,
        created_at:    workflow.created_at,
        updated_at:    workflow.updated_at,
        steps: workflow.steps.map(s => {
          const p = JSON.parse(s.params) as { step_order: number; step_type: string }
          return {
            id:             s.id,
            status:         s.status,
            step_order:     p.step_order,
            step_type:      p.step_type,
            started_at:     s.started_at,
            completed_at:   s.completed_at,
            result_snippet: s.result ? s.result.slice(0, 200) : null,
          }
        }),
      },
      { status: 200 },
    )
  } catch (err) {
    logger.error('[GET /api/raas/workflows/[id]]', err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 })
  }
}
