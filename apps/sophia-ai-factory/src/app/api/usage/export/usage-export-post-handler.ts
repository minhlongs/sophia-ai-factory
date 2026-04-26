/**
 * POST /api/usage/export — export with JWT + API key auth and audit logging
 * @module app/api/usage/export/usage-export-post-handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { getCurrentUser } from '@/lib/better-auth-session'
import { isUserAdminWithRole } from '@/lib/auth/is-user-admin'
import { validateApiKey } from '@/lib/security/api-key-validator'
import { logUsageWithReceipt } from '@/lib/audit/audit-logger'
import { generateCompleteExport, createDownloadableExport } from '@/lib/usage-export/export-service'
import { logger } from '@/lib/utils/logger-utility'
import type { BillingPeriod, ExportFormat } from '@/lib/usage-export/types'
import { postExportRequestSchema } from './usage-export-schemas'

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const user = await getCurrentUser()
    if (!user) {
      logger.warn('[Usage Export POST] Authentication failed', { requestId })
      return NextResponse.json({ error: 'Unauthorized - Invalid JWT' }, { status: 401 })
    }
    const supabase = createServerClient()

    const apiValidation = await validateApiKey(req.headers.get('x-api-key'))
    if (!apiValidation.valid) {
      logger.warn('[Usage Export POST] API key validation failed', { requestId, error: apiValidation.error })
      return NextResponse.json({ error: 'Unauthorized - Invalid API key', errorCode: apiValidation.error }, { status: 401 })
    }

    const hasPermission = apiValidation.apiKey?.permissions?.includes('usage:export') ?? false
    if (!hasPermission) {
      logger.warn('[Usage Export POST] Insufficient permissions', { requestId, keyId: apiValidation.apiKey?.keyId })
      return NextResponse.json({ error: 'Forbidden - API key lacks usage:export permission' }, { status: 403 })
    }

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

    const parseResult = postExportRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parseResult.error.issues }, { status: 400 })
    }

    const { billingPeriod, startDate, endDate, externalCustomerId, format, service, licenseNonce, page, pageSize } = parseResult.data
    const { isAdmin, dbRole } = await isUserAdminWithRole(user)

    if (!isAdmin) {
      if (externalCustomerId && licenseNonce) {
        const { data: license } = await supabase.from('raas_licenses').select('created_by').eq('nonce', licenseNonce).single()
        if (!license || license.created_by !== user.id) return NextResponse.json({ error: 'Forbidden - Not your license' }, { status: 403 })
      } else if (externalCustomerId) {
        const { data: licenseCheck } = await supabase.from('raas_licenses').select('created_by').eq('polar_customer_id', externalCustomerId).single()
        if (!licenseCheck || licenseCheck.created_by !== user.id) return NextResponse.json({ error: 'Forbidden - Not your customer ID' }, { status: 403 })
      }
    }

    const exportResponse = await generateCompleteExport({
      billingPeriod: billingPeriod as BillingPeriod, startDate, endDate,
      externalCustomerId, format: format as ExportFormat, service, licenseNonce, page, pageSize,
    })

    const auditReceipt = await logUsageWithReceipt({
      nonce: licenseNonce || 'system-export', model_name: 'usage-export',
      token_count: exportResponse.records?.length || 0,
      endpoint: '/api/usage/export', userId: user.id, tier: dbRole || 'user',
    })

    logger.info('[Usage Export POST] Export completed', {
      requestId, userId: user.id, isAdmin, billingPeriod, format,
      recordCount: exportResponse.records?.length || 0, auditReceiptId: auditReceipt?.receiptId,
    })

    const auditHeader = auditReceipt ? Buffer.from(JSON.stringify(auditReceipt)).toString('base64url') : ''

    if (format === 'csv') {
      const downloadable = createDownloadableExport(exportResponse, 'csv')
      return new NextResponse(downloadable.content, {
        headers: {
          'Content-Type': downloadable.contentType,
          'Content-Disposition': `attachment; filename="${downloadable.filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Request-ID': requestId, 'X-Audit-Receipt': auditHeader,
        },
      })
    }

    return NextResponse.json({ ...exportResponse, metadata: { ...exportResponse.metadata, requestId, auditReceiptId: auditReceipt?.receiptId, exportedAt: new Date().toISOString() } }, {
      headers: { 'X-Request-ID': requestId, 'X-Audit-Receipt': auditHeader },
    })
  } catch (error) {
    logger.error('[Usage Export POST] Error', error instanceof Error ? error : new Error(String(error)), { requestId })
    return NextResponse.json({ error: 'Failed to export usage', requestId }, { status: 500 })
  }
}
