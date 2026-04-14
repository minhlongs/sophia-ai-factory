/**
 * API Endpoint: GET /api/admin/audit/receipt
 * Generate compliance receipt for an audit log entry
 *
 * Query params:
 * - logId: UUID of the audit log entry
 *
 * Returns signed receipt that can be verified by customers/auditors
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { generateReceipt, serializeReceipt } from '@/lib/audit/compliance-receipt'
import { checkAdminAuth } from '@/app/api/admin/licenses/middleware'
import { logger } from '@/lib/utils/logger-utility'
import { z } from 'zod'
import { rateLimit } from '@/lib/security/rate-limiter'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

// Query params validation schema
const receiptQuerySchema = z.object({
  logId: z.string().uuid('Invalid UUID format')
})

/**
 * GET /api/admin/audit/receipt?logId=<uuid>
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authError = checkAdminAuth(request)
  if (authError) return authError

  // Rate limiting: 100 requests per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'receipt_generation', 100, 60)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.resetAt - Date.now()
      },
      { status: 429 }
    )
  }

  try {
    const { searchParams } = request.nextUrl
    const params = receiptQuerySchema.parse({
      logId: searchParams.get('logId')
    })

    // Fetch audit log from database
    const db = createServerClient()
    const { data: log, error: fetchError } = await db
      .from('raas_audit_logs')
      .select('*')
      .eq('id', params.logId)
      .single()

    if (fetchError || !log) {
      logger.warn('Audit log not found', { logId: params.logId, error: fetchError })
      return NextResponse.json(
        { error: 'Audit log not found' },
        { status: 404 }
      )
    }

    // Generate receipt (cast to RaasAuditLogRow for type safety)
    const auditLog = log as RaasAuditLogRow
    const receipt = generateReceipt(auditLog)

    logger.info('Generated compliance receipt', {
      auditLogId: auditLog.id,
      receiptId: receipt.receiptId,
      action: auditLog.action
    })

    return NextResponse.json({
      success: true,
      receipt,
      serialized: serializeReceipt(receipt),
      metadata: {
        generatedAt: new Date(receipt.issuedAt * 1000).toISOString(),
        expiresAt: new Date(receipt.expiresAt * 1000).toISOString(),
        verificationEndpoint: '/api/admin/audit/receipt/verify'
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid query parameters', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    logger.error('Failed to generate compliance receipt', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to generate receipt' },
      { status: 500 }
    )
  }
}
