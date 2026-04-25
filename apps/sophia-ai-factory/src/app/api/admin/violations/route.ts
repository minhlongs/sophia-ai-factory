/**
 * GET /api/admin/violations — list violations with filtering
 * POST /api/admin/violations — resolve or escalate a violation
 * Admin-only endpoints
 * @module api/admin/violations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { getCurrentUser } from '@/lib/better-auth-session'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import { checkAdminAuth } from '../middleware'
import { z } from 'zod'
import { violationActionSchema } from './violations-schemas'

export { GET } from './violations-get-handler'

export async function POST(req: NextRequest) {
  try {
    const authError = checkAdminAuth(req)
    if (authError) return authError

    const body = await req.json()
    const parsed = violationActionSchema.parse(body)
    const currentUser = await getCurrentUser()
    const currentUserId = currentUser?.id
    const db = createServerClient()

    if (parsed.action === 'resolve') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from('violations').update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: currentUserId }).eq('id', parsed.violationId)
      if (error) { logger.error('[Violations] Error resolving violation', error); return NextResponse.json({ error: 'Failed to resolve violation' }, { status: 500 }) }
      logger.info('[Violations] Violation resolved', { violationId: parsed.violationId, reason: parsed.reason, resolvedBy: currentUserId })
      return NextResponse.json({ success: true, action: 'resolve', violationId: parsed.violationId, resolvedAt: new Date().toISOString() })
    }

    if (parsed.action === 'escalate') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from('violations').update({ metadata: { escalated: true, escalatedAt: new Date().toISOString(), reason: parsed.reason } }).eq('id', parsed.violationId)
      logger.warn('[Violations] Violation escalated', { violationId: parsed.violationId, reason: parsed.reason })
      return NextResponse.json({ success: true, action: 'escalate', violationId: parsed.violationId, escalatedAt: new Date().toISOString() })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Violations] Invalid request body', { issues: error.issues })
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }
    logger.error('[Violations] Error performing action', toError(error))
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
