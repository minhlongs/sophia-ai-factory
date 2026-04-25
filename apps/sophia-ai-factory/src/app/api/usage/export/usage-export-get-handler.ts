/**
 * GET /api/usage/export — export usage data
 * @module app/api/usage/export/usage-export-get-handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { getCurrentUser } from '@/lib/better-auth-session'
import { exportUsage, generateCsv } from '@/lib/usage-metering/export'
import { logger } from '@/lib/utils/logger-utility'
import { exportQuerySchema } from './usage-export-schemas'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const supabase = createServerClient()
    const parseResult = exportQuerySchema.safeParse({
      start: searchParams.get('start'), end: searchParams.get('end'),
      format: searchParams.get('format'), service: searchParams.get('service'),
      license_nonce: searchParams.get('license_nonce'),
    })
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query params', details: parseResult.error.issues }, { status: 400 })
    }

    const { start, end, format, service, license_nonce } = parseResult.data
    const now = Math.floor(Date.now() / 1000)
    if (start > end) return NextResponse.json({ error: 'start must be before end' }, { status: 400 })
    if (start > now || end > now) return NextResponse.json({ error: 'Date range cannot be in the future' }, { status: 400 })
    const maxRange = 90 * 86400
    if (end - start > maxRange) {
      return NextResponse.json({ error: `Date range exceeds maximum of ${maxRange} seconds (${Math.floor(maxRange / 86400)} days)`, suggestion: 'Split your request into multiple smaller date ranges' }, { status: 400 })
    }

    const { data: userData } = await supabase.from('user_profiles').select('role').eq('user_id', user.id).single()
    const isAdmin = userData?.role === 'admin' || user.user_metadata?.role === 'admin'
    const userId = user.id

    if (license_nonce && !isAdmin) {
      const { data: license } = await supabase.from('raas_licenses').select('created_by').eq('nonce', license_nonce).single()
      if (!license || license.created_by !== user.id) {
        return NextResponse.json({ error: 'Forbidden - not your license' }, { status: 403 })
      }
    }

    const usageData = await exportUsage({
      userId: isAdmin && license_nonce ? undefined : userId,
      licenseNonce: license_nonce,
      startTimestamp: start, endTimestamp: end, service, format,
    })
    logger.info('[Usage Export API] Exported usage', { userId, isAdmin, format, service, eventCount: usageData.events.length })

    if (format === 'csv') {
      const csv = generateCsv(usageData.events)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="usage-export-${userId}-${start}-${end}.csv"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    return NextResponse.json({
      summary: usageData.summary, daily: usageData.daily, events: usageData.events, aggregated: usageData.aggregated,
      metadata: {
        userId: isAdmin ? 'all' : userId, licenseNonce: license_nonce || 'all', service: service || 'all',
        startTimestamp: start, endTimestamp: end, totalEvents: usageData.events.length,
        totalCredits: usageData.aggregated?.totalCredits || 0, totalRequests: usageData.aggregated?.totalRequests || 0,
        exportedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    logger.error('[Usage Export API] Error exporting usage', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to export usage' }, { status: 500 })
  }
}
