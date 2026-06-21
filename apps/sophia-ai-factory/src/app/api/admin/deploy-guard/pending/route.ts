/**
 * GET /api/admin/deploy-guard/pending
 * List pending approval requests.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const approvals = await approvalService.listPending(limit, offset)

    return NextResponse.json({
      approvals,
      count: approvals.length,
      limit,
      offset
    })
  } catch (error) {
    console.error('Failed to list pending approvals:', error)
    return NextResponse.json(
      { error: 'Failed to list pending approvals', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
