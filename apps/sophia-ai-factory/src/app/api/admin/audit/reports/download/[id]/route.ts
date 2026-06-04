/**
 * API Endpoint: GET /api/admin/audit/reports/download/[id]
 *
 * Download a generated compliance report (PDF/CSV/JSON)
 *
 * Authentication: Basic Auth (Admin only)
 * Rate Limit: 20 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/seed/auth/require-admin'
import { rateLimit } from '@/seed/security/rate-limiter'
import { logger } from '@/seed/utils/logger-utility'
import { downloadStoredReport } from '@/tree/audit/report-delivery'
import { createServerClient } from '@/seed/db/client'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/audit/reports/download/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'report_download', 20, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.resetAt - Date.now() },
      { status: 429 }
    )
  }

  try {
    const { id } = await params

    // Fetch report metadata from database
    const db = createServerClient()
    const { data: report, error: fetchError } = await (db.from('compliance_reports') as ReturnType<typeof db.from>)
      .select('id, report_type, format, storage_path, file_size')
      .eq('id', id)
      .single() as { data: { id: string; report_type: string; format: string; storage_path: string; file_size: number } | null; error: Error | null }

    if (fetchError || !report) {
      logger.warn('[API] Report not found', { reportId: id, error: fetchError })
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Download from storage
    const content = await downloadStoredReport(id, report.format)

    if (!content) {
      logger.warn('[API] Report content not found in storage', {
        reportId: id,
        storagePath: report.storage_path
      })
      return NextResponse.json(
        { error: 'Report content not found' },
        { status: 404 }
      )
    }

    // Determine content type and extension
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html'
    }

    const contentType = contentTypes[report.format] || 'application/octet-stream'
    const extension = report.format === 'pdf' ? 'pdf' : report.format

    // Create response with file download
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(content)
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="compliance-report-${report.report_type}-${id}.${extension}"`,
        'Content-Length': content.length.toString()
      }
    })
  } catch (error) {
    logger.error('[API] Download report failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to download report' },
      { status: 500 }
    )
  }
}
