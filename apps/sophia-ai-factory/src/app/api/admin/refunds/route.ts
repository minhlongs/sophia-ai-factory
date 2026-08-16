/**
 * GET /api/admin/refunds — list all refund requests (admin only)
 *
 * @module app/api/admin/refunds/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { listPendingRefunds } from '@/land/refunds/refund-repo'
import { logger } from '@/seed/utils/logger-utility'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  try {
    const refunds = await listPendingRefunds()
    return NextResponse.json({ refunds })
  } catch (err) {
    logger.error('[AdminRefunds] List failed', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
