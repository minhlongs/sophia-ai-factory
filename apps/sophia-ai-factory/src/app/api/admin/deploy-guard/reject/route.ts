/**
 * POST /api/admin/deploy-guard/reject
 * Reject a pending deployment approval with rationale.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const operatorId = auth.userId || 'unknown'

    if (!body.approvalId || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, reason' },
        { status: 400 }
      )
    }

    await approvalService.rejectApproval(body.approvalId, operatorId, body.reason)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reject approval:', error)
    return NextResponse.json(
      { error: 'Failed to reject approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
