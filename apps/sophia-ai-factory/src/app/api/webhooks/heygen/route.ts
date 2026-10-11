/**
 * HeyGen Webhook Receiver Route
 * Re-exports from modular land/webhooks/heygen
 * @module app/api/webhooks/heygen
 */

import { NextRequest, NextResponse } from 'next/server'
import { handleHeyGenWebhook } from '@/land/webhooks/heygen/index'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleHeyGenWebhook(req)
}
