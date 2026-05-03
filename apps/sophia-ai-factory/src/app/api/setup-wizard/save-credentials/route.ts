/**
 * POST /api/setup-wizard/save-credentials
 *
 * Saves user provider credentials (HeyGen, Resend, NOWPayments) encrypted
 * to the user_provider_credentials D1 table.
 * When heygen_api_key is saved, auto-registers Sophia's webhook with HeyGen API.
 * Auth required. Input validated via Zod.
 *
 * @module app/api/setup-wizard/save-credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/better-auth-session'
import { setUserCredential } from '@/lib/credentials/user-credentials-repo'
import { registerHeyGenWebhook } from '@/lib/heygen/webhook-registrar'
import { logger } from '@/lib/utils/logger-utility'
import type { ProviderType } from '@/lib/credentials/user-credentials-repo'

const SOPHIA_HEYGEN_WEBHOOK_URL = 'https://sophia.agencyos.network/api/webhooks/heygen'

const saveCredentialsSchema = z.object({
  heygen_api_key: z.string().trim().optional(),
  heygen_webhook_secret: z.string().trim().optional(),
  resend_api_key: z.string().trim().optional(),
  nowpayments_api_key: z.string().trim().optional(),
  nowpayments_ipn_secret: z.string().trim().optional(),
})

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = saveCredentialsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 },
    )
  }

  const {
    heygen_api_key,
    heygen_webhook_secret,
    resend_api_key,
    nowpayments_api_key,
  } = parsed.data

  const saves: Array<{ provider: ProviderType; key: string }> = []
  if (heygen_api_key) saves.push({ provider: 'heygen', key: heygen_api_key })
  if (heygen_webhook_secret) saves.push({ provider: 'heygen_webhook_secret', key: heygen_webhook_secret })
  if (resend_api_key) saves.push({ provider: 'resend', key: resend_api_key })
  if (nowpayments_api_key) saves.push({ provider: 'nowpayments', key: nowpayments_api_key })

  if (saves.length === 0) {
    return NextResponse.json({ success: false, message: 'No credentials provided' }, { status: 400 })
  }

  const errors: string[] = []
  let webhookAutoRegistered = false

  for (const { provider, key } of saves) {
    try {
      await setUserCredential(user.id, provider, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${provider}: ${msg}`)
    }
  }

  // Auto-register HeyGen webhook when heygen_api_key is saved — fail-soft
  if (heygen_api_key && !errors.some((e) => e.startsWith('heygen:'))) {
    const regResult = await registerHeyGenWebhook(heygen_api_key, SOPHIA_HEYGEN_WEBHOOK_URL)
    if (regResult.success) {
      webhookAutoRegistered = true
      // Auto-store the signing secret so customer never sees/touches it
      if (regResult.signingSecret) {
        try {
          await setUserCredential(user.id, 'heygen_webhook_secret', regResult.signingSecret)
        } catch (err) {
          logger.warn('[SaveCredentials] Failed to auto-store heygen_webhook_secret', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } else {
      logger.warn('[SaveCredentials] HeyGen auto-register failed (non-fatal)', {
        userId: user.id,
        error: regResult.error,
      })
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { success: false, message: errors.join('; ') },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    saved: saves.map((s) => s.provider),
    webhookAutoRegistered,
  })
}
