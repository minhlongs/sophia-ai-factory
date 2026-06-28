/**
 * POST /api/admin/deploy-guard/reject
 * Reject a pending deployment approval with rationale.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json() as { approvalId: string; reason: string }
    const operatorId = auth.user.id || 'unknown'

    if (!body.approvalId || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, reason' },
        { status: 400 }
      )
    }

    await approvalService.rejectApproval(body.approvalId, operatorId, body.reason)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to reject approval', error instanceof Error ? error : { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to reject approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
