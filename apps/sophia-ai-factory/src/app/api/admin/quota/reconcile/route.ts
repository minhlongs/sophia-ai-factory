/**
 * API Endpoint: POST /api/admin/quota/reconcile
 * Manual trigger for overage billing reconciliation
 *
 * Auth: Admin-only via Basic Auth
 * Method: POST only
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/app/api/admin/licenses/middleware'
import { logger } from '@/lib/utils/logger-utility'
import { reconcileOverageEvents } from '@/lib/billing/overage-billing-reconciler'
import { z } from 'zod'
import type { ReconciliationResult } from '@/lib/billing/billing-types'

/**
 * Request body schema (optional config overrides)
 */
const reconcileRequestSchema = z.object({
  force: z.boolean().optional().default(false),
  dryRun: z.boolean().optional().default(false),
}).optional()

/**
 * Response schema for type safety
 */
interface ReconcileResponse {
  success: boolean
  scannedEvents: number
  billableEvents: number
  totalCharge: number
  charges: Array<{
    userId: string
    licenseNonce: string
    tier: string
    overageCredits: number
    totalCharge: number
  }>
  invoiceItemsCreated: number
  eventsMarkedAsBilled: number
  errors: Array<{
    type: string
    message: string
  }>
}

/**
 * POST /api/admin/quota/reconcile
 * Manually trigger overage billing reconciliation
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    // Parse optional request body
    const body = await request.json().catch(() => null)
    const parsed = reconcileRequestSchema.safeParse(body)

    if (!parsed.success) {
      logger.warn('[Reconcile API] Invalid request body', { issues: parsed.issues })
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.issues },
        { status: 400 }
      )
    }

    const { dryRun } = parsed.data || {}

    // If dry run, just return what would be billed
    if (dryRun) {
      logger.info('[Reconcile API] Dry run requested - scanning unbilled events only')
      const { scanUnbilledOverageEvents, calculateOverageCharges } = await import('@/lib/billing/overage-billing-reconciler')

      const unbilledGroups = await scanUnbilledOverageEvents()
      const charges = unbilledGroups.map(group => calculateOverageCharges(group))
      const totalCharge = charges.reduce((sum, c) => sum + c.totalCharge, 0)

      const response: ReconcileResponse = {
        success: true,
        scannedEvents: unbilledGroups.reduce((sum, g) => sum + g.events.length, 0),
        billableEvents: 0,
        totalCharge,
        charges: charges.map(c => ({
          userId: c.userId,
          licenseNonce: c.licenseNonce,
          tier: c.tier,
          overageCredits: c.overageCredits,
          totalCharge: c.totalCharge,
        })),
        invoiceItemsCreated: 0,
        eventsMarkedAsBilled: 0,
        errors: [],
      }

      return NextResponse.json(response)
    }

    // Execute reconciliation
    logger.info('[Reconcile API] Starting manual reconciliation')
    const result: ReconciliationResult = await reconcileOverageEvents()

    // Build response
    const response: ReconcileResponse = {
      success: result.success,
      scannedEvents: result.scannedEvents,
      billableEvents: result.billableEvents,
      totalCharge: result.totalCharge,
      charges: result.charges.map(c => ({
        userId: c.userId,
        licenseNonce: c.licenseNonce,
        tier: c.tier,
        overageCredits: c.overageCredits,
        totalCharge: c.totalCharge,
      })),
      invoiceItemsCreated: result.invoiceItemsCreated,
      eventsMarkedAsBilled: result.eventsMarkedAsBilled,
      errors: result.errors.map(e => ({
        type: e.type,
        message: e.message,
      })),
    }

    logger.info('[Reconcile API] Reconciliation complete', {
      scannedEvents: response.scannedEvents,
      billableEvents: response.billableEvents,
      totalCharge: response.totalCharge,
      errors: response.errors.length,
    })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('[Reconcile API] Reconciliation failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Reconciliation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed - Use POST to trigger reconciliation' },
    { status: 405 }
  )
}
