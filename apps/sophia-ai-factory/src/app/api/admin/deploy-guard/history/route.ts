/**
 * GET /api/admin/deploy-guard/history
 * Get deploy guard audit history.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { approvalService } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const cursor = searchParams.get('cursor') || undefined

    const result = await approvalService.getHistory(limit, cursor)

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Failed to get history', error instanceof Error ? error : { error: String(error) })
    return NextResponse.json(
      { error: 'Failed to get history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
