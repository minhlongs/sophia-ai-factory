/**
 * API Endpoint: GET /api/user/audit-logs
 * Get audit logs for the currently authenticated user
 *
 * Users can only view their own audit logs (last 90 days)
 * Admins can view all audit logs via /api/admin/licenses/audit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { getCurrentUser } from '@/lib/better-auth-session'
import { logger } from '@/lib/utils/logger-utility'
import { z } from 'zod'

/**
 * Query params validation schema
 * Note: Audit logs retained for 90 days per SOC 2 compliance
 */
const userAuditLogSchema = z.object({
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
 * GET /api/user/audit-logs?page=1&limit=50
 * Returns audit logs for the currently authenticated user
 * Filtered to last 90 days per compliance policy
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()

    if (!user) {
      logger.warn('User audit logs: Authentication failed')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    const supabase = createServerClient()

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const params = userAuditLogSchema.parse(Object.fromEntries(searchParams))

    // Apply 90 days retention policy
    const ninetyDaysAgo = getNinetyDaysAgoTimestamp()

    // Fetch user's audit logs
    // RLS policy ensures users can only see their own logs
    const { data, error, count } = await supabase
      .from('raas_audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .range((params.page - 1) * params.limit, params.page * params.limit - 1)

    if (error) {
      logger.error('Failed to fetch user audit logs', error)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil((count || 0) / params.limit),
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
    logger.error('API: GET /api/user/audit-logs failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
