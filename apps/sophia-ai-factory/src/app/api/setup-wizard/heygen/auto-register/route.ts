/**
 * POST /api/setup-wizard/heygen/auto-register
 * Manual re-register button — re-runs HeyGen webhook auto-registration
 * for the current user's stored API key.
 * Auth required (any logged-in user for their own key).
 *
 * @module app/api/setup-wizard/heygen/auto-register/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getUserCredential, setUserCredential } from '@/tree/credentials/user-credentials-repo'
;import { registerHeyGenWebhook } from '@/land/heygen/webhook-registrar'
import { logger } from '@/seed/utils/logger-utility'

const SOPHIA_HEYGEN_WEBHOOK_URL = 'https://sophia.agencyos.network/api/webhooks/heygen'

export async function POST(request: NextRequest): Promise<NextResponse> { // eslint-disable-line @typescript-eslint/no-unused-vars
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = await getUserCredential(user.id, 'heygen')
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'No HeyGen API key configured. Please add your API key first.' },
      { status: 400 },
    )
  }

  const result = await registerHeyGenWebhook(apiKey, SOPHIA_HEYGEN_WEBHOOK_URL)

  if (result.success && result.signingSecret) {
    try {
      await setUserCredential(user.id, 'heygen_webhook_secret', result.signingSecret)
    } catch (err) {
      logger.warn('[HeyGenAutoRegister] Failed to store signing secret', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    success: result.success,
    endpointId: result.endpointId,
    webhookUrl: SOPHIA_HEYGEN_WEBHOOK_URL,
    secretStored: result.success && !!result.signingSecret,
    error: result.error,
  })
}

