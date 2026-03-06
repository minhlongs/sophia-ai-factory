/**
 * API Endpoint: GET /api/admin/licenses/audit
 * Get audit logs for license operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs } from '@/lib/raas-audit'
import { checkAdminAuth } from '../middleware'
import { logger } from '@/lib/utils/logger-utility'
import type { AuditAction } from '@/lib/raas-schema'
import { z } from 'zod'

/**
 * Query params validation schema
 * Note: Audit logs retained for 30 days only
 */
const auditLogSchema = z.object({
  action: z.enum(['CREATE', 'VALIDATE', 'REVOKE', 'UPDATE']).optional(),
  nonce: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
})

/**
 * Calculate timestamp for 30 days ago
 * Audit logs are retained for 30 days only per compliance policy
 */
function getThirtyDaysAgoTimestamp(): number {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return Math.floor(thirtyDaysAgo.getTime() / 1000)
}

/**
 * GET /api/admin/licenses/audit?action=CREATE|REVOKE&nonce=xxx&page=1&limit=50
 * Note: Logs retained for 30 days only
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const searchParams = request.nextUrl.searchParams
    const params = auditLogSchema.parse(Object.fromEntries(searchParams))

    // Apply 30 days retention policy
    const thirtyDaysAgo = getThirtyDaysAgoTimestamp()

    const result = await getAuditLogs({
      action: params.action,
      license_nonce: params.nonce,
      page: params.page,
      limit: params.limit,
      orderBy: 'created_at',
      orderDir: 'desc',
      // Filter: only logs from last 30 days
      startDate: thirtyDaysAgo
    } as any)

    return NextResponse.json({
      ...result,
      retentionNote: 'Audit logs retained for 30 days',
      retentionDays: 30
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid query parameters', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }
    logger.error('API: GET /api/admin/licenses/audit failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
