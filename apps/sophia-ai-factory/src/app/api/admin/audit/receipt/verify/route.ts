/**
 * API Endpoint: POST /api/admin/audit/receipt/verify
 * Verify a compliance receipt's signature and expiration
 *
 * Request body:
 * - receiptJson: JSON string of ComplianceReceipt object
 * - OR receiptId + signature for lookup verification
 *
 * Returns verification result with detailed error information
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyReceipt,
  verifyReceiptDetailed,
  parseReceipt
} from '@/lib/audit/compliance-receipt'
import type { ComplianceReceipt } from '@/lib/audit/compliance-receipt'
import { requireAdmin } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'
import { z } from 'zod'
import { rateLimit } from '@/seed/security/rate-limiter'

// Request body validation schema
const verifyReceiptSchema = z.object({
  receiptJson: z.string().optional(),
  receiptId: z.string().uuid().optional(),
  signature: z.string().min(64).max(64).optional()
}).refine(
  data => data.receiptJson || (data.receiptId && data.signature),
  'Must provide either receiptJson or both receiptId and signature'
)

/**
 * POST /api/admin/audit/receipt/verify
 * Body: { receiptJson: string } OR { receiptId: string, signature: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  // Rate limiting: 200 requests per minute per IP (verification is cheaper)
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitResult = await rateLimit(ip, 'receipt_verification', 200, 60)

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
    const body = await request.json()
    const params = verifyReceiptSchema.parse(body)

    let receipt: ComplianceReceipt | null = null

    if (params.receiptJson) {
      // Parse receipt from JSON string
      receipt = parseReceipt(params.receiptJson)
      if (!receipt) {
        logger.warn('Invalid receipt JSON format')
        return NextResponse.json(
          { error: 'Invalid receipt format - unable to parse JSON' },
          { status: 400 }
        )
      }
    }

    // If we have a receipt (from JSON), verify it
    if (receipt) {
      const result = verifyReceiptDetailed(receipt)

      logger.info('Receipt verification result', {
        receiptId: result.receiptId,
        valid: result.valid,
        reason: result.reason
      })

      return NextResponse.json({
        success: result.valid,
        receiptId: result.receiptId,
        message: result.message,
        ...(result.reason && { reason: result.reason })
      })
    }

    // Future: Support lookup verification by receiptId + signature
    // This would require storing receipts in database
    return NextResponse.json(
      { error: 'receiptJson is required (lookup verification not yet implemented)' },
      { status: 400 }
    )

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    logger.error('Failed to verify receipt', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to verify receipt' },
      { status: 500 }
    )
  }
}
