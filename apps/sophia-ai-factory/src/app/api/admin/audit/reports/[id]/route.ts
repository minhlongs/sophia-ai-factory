/**
 * API Endpoint: GET, DELETE /api/admin/audit/reports/[id]
 *
 * GET - Get scheduled report details
 * DELETE - Cancel a scheduled report
 *
 * Authentication: Basic Auth (Admin only)
 * Rate Limit: 50 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { rateLimit } from '@/lib/security/rate-limiter'
import { logger } from '@/lib/utils/logger-utility'
import { cancelScheduledReport, getDueReports } from '@/lib/audit/report-scheduler'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/audit/reports/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'report_details', 50, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.resetAt - Date.now() },
      { status: 429 }
    )
  }

  try {
    const { id } = await params

    // Get due reports and find the specific one
    const reports = await getDueReports()
    const report = reports.find((r) => r.id === id)

    if (!report) {
      // Report might not be due yet, return not found
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    logger.info('[API] Report details retrieved', { reportId: id })

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        nextRunAt: new Date(report.nextRunAt * 1000).toISOString(),
        createdAt: new Date(report.createdAt * 1000).toISOString()
      }
    })
  } catch (error) {
    logger.error('[API] Get report details failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to retrieve report details' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/audit/reports/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'report_cancel', 20, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.resetAt - Date.now() },
      { status: 429 }
    )
  }

  try {
    const { id } = await params

    // Cancel the scheduled report
    await cancelScheduledReport(id)

    logger.info('[API] Report cancelled', { reportId: id })

    return NextResponse.json({
      success: true,
      message: 'Report cancelled successfully'
    })
  } catch (error) {
    logger.error('[API] Cancel report failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to cancel report' },
      { status: 500 }
    )
  }
}
