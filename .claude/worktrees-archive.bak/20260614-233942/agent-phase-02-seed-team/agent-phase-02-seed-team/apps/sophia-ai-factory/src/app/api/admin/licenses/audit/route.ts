/**
 * API Endpoint: GET /api/admin/licenses/audit
 * Get audit logs for license operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuditLogs } from '@/forest/raas-audit'
import { requireAdmin } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'
import type { AuditAction, RaasAuditLogFilters } from '@/forest/raas-schema'
import { z } from 'zod'

/**
 * Query params validation schema
 * Note: Audit logs retained for 90 days per SOC 2 compliance
 */
const auditLogSchema = z.object({
  action: z.enum(['CREATE', 'VALIDATE', 'REVOKE', 'UPDATE']).optional(),
  nonce: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
})

/**
 * Calculate timestamp for 90 days ago
 * Audit logs are retained for 90 days per SOC 2 compliance policy
 */
function getNinetyDaysAgoTimestamp(): number {
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  return Math.floor(ninetyDaysAgo.getTime() / 1000)
}

/**
 * GET /api/admin/licenses/audit?action=CREATE|REVOKE&nonce=xxx&page=1&limit=50
 * Note: Logs retained for 30 days only
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams
    const params = auditLogSchema.parse(Object.fromEntries(searchParams))

    // Apply 90 days retention policy
    const ninetyDaysAgo = getNinetyDaysAgoTimestamp()

    const auditFilters: RaasAuditLogFilters = {
      action: params.action as AuditAction | undefined,
      license_nonce: params.nonce,
      page: params.page,
      limit: params.limit,
      orderBy: 'created_at',
      orderDir: 'desc',
      // Filter: only logs from last 90 days
      startDate: ninetyDaysAgo,
    }
    const result = await getAuditLogs(auditFilters)

    return NextResponse.json({
      ...result,
      retentionNote: 'Audit logs retained for 90 days per SOC 2 compliance',
      retentionDays: 90
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
