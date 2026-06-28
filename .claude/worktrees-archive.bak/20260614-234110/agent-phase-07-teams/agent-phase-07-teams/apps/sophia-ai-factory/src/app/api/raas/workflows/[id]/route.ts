/**
 * GET /api/raas/workflows/[id] — fetch single workflow + ordered step missions
 *
 * Auth: getCurrentUser() (Better Auth session required)
 * 404 returned for missing workflow OR wrong org (prevents cross-tenant enumeration).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getWorkflow } from '@/seed/db/workflow-repository'
import { logger } from '@/seed/utils/logger-utility'
import { resolveOrgId } from '@/seed/auth/resolve-org-id'

export const dynamic = 'force-dynamic'

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
