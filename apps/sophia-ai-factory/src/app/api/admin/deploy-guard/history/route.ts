/**
 * GET /api/admin/deploy-guard/history
 * Get deploy guard audit history.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const cursor = searchParams.get('cursor') || undefined

    const result = await approvalService.getHistory(limit, cursor)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to get history:', error)
    return NextResponse.json(
      { error: 'Failed to get history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
