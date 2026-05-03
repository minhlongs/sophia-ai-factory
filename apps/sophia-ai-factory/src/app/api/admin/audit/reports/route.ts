/**
 * API Endpoint: GET, POST /api/admin/audit/reports
 *
 * GET - List all scheduled reports for admin
 * POST - Create a new scheduled report
 *
 * Authentication: Basic Auth (Admin only)
 * Rate Limit: 50 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { rateLimit } from '@/seed/security/rate-limiter'
import { logger } from '@/seed/utils/logger-utility'
import { z } from 'zod'
import {
  scheduleReport,
  getScheduledReports,
  type ReportType,
  type ReportFormat,
  type ReportFrequency,
  type ReportFilters
} from '@/tree/audit/report-scheduler'

// Request body validation schema
const scheduleReportSchema = z.object({
  type: z.enum(['compliance', 'usage', 'billing']),
  format: z.enum(['pdf', 'csv', 'json']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly']),
  recipients: z.array(z.string().email()),
  filters: z.object({
    startDate: z.number().optional(),
    endDate: z.number().optional(),
    licenseNonce: z.string().optional(),
    modelNames: z.array(z.string()).optional(),
    tiers: z.array(z.string()).optional(),
    includePII: z.boolean().optional()
  }).optional(),
  createdBy: z.string()
})

// GET /api/admin/audit/reports
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const adminId = `admin-${auth.user.id}`;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'report_list', 50, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.resetAt - Date.now() },
      { status: 429 }
    )
  }

  try {
    // Get all scheduled reports
    const reports = await getScheduledReports(adminId)

    logger.info('[API] Scheduled reports retrieved', {
      adminId,
      count: reports.length
    })

    return NextResponse.json({
      success: true,
      data: reports.map((report) => ({
        ...report,
        nextRunAt: new Date(report.nextRunAt * 1000).toISOString(),
        createdAt: new Date(report.createdAt * 1000).toISOString()
      }))
    })
  } catch (error) {
    logger.error('[API] Get scheduled reports failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to retrieve scheduled reports' },
      { status: 500 }
    )
  }
}

// POST /api/admin/audit/reports
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'report_schedule', 20, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.resetAt - Date.now() },
      { status: 429 }
    )
  }

  try {
    // Parse request body
    const body = await request.json()
    const validatedData = scheduleReportSchema.parse(body)
    const adminUser = auth.user.email ?? auth.user.id;

    // Schedule the report
    const scheduledReport = await scheduleReport({
      type: validatedData.type as ReportType,
      format: validatedData.format as ReportFormat,
      frequency: validatedData.frequency as ReportFrequency,
      recipients: validatedData.recipients,
      filters: validatedData.filters as ReportFilters,
      createdBy: adminUser
    })

    logger.info('[API] Report scheduled', {
      reportId: scheduledReport.id,
      type: scheduledReport.type,
      frequency: scheduledReport.frequency,
      admin: adminUser
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...scheduledReport,
          nextRunAt: new Date(scheduledReport.nextRunAt * 1000).toISOString(),
          createdAt: new Date(scheduledReport.createdAt * 1000).toISOString()
        }
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[API] Invalid request body', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      )
    }

    logger.error('[API] Schedule report failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to schedule report' },
      { status: 500 }
    )
  }
}
