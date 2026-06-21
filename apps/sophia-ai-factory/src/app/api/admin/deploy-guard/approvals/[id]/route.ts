/**
 * GET /api/admin/deploy-guard/approvals/[id]
 * Get approval details with attestations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const approval = await approvalService.getApproval(id)

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error('Failed to get approval:', error)
    return NextResponse.json(
      { error: 'Failed to get approval', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
