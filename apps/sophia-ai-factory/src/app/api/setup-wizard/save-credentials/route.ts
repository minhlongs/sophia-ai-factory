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
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { setUserCredential } from '@/tree/credentials/user-credentials-repo'
import { registerHeyGenWebhook } from '@/land/heygen/webhook-registrar'
import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import { enqueueWelcomeEmail } from '@/tree/email/outbox'
import type { ProviderType } from '@/tree/credentials/user-credentials-repo'
import { sanitizeCredential } from '@/tree/byok/key-format-validators'

const SOPHIA_HEYGEN_WEBHOOK_URL = 'https://sophia.agencyos.network/api/webhooks/heygen'

const saveCredentialsSchema = z.object({
  heygen_api_key: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
  heygen_webhook_secret: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
  resend_api_key: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
  nowpayments_api_key: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
  nowpayments_ipn_secret: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
  routing_strategy: z.enum(['priority', 'costOptimized', 'leastUsed']).optional(),
})

type SaveCredentialsInput = z.infer<typeof saveCredentialsSchema>

function buildSaveList(data: SaveCredentialsInput): Array<{ provider: ProviderType; key: string }> {
  const saves: Array<{ provider: ProviderType; key: string }> = []
  if (data.heygen_api_key) saves.push({ provider: 'heygen', key: data.heygen_api_key })
  if (data.heygen_webhook_secret) saves.push({ provider: 'heygen_webhook_secret', key: data.heygen_webhook_secret })
  if (data.resend_api_key) saves.push({ provider: 'resend', key: data.resend_api_key })
  if (data.nowpayments_api_key) saves.push({ provider: 'nowpayments', key: data.nowpayments_api_key })
  return saves
}

async function handleHeyGenWebhookAutoRegister(
  userId: string,
  heygenApiKey: string | undefined,
  credErrors: string[],
): Promise<boolean> {
  if (!heygenApiKey || credErrors.some((e) => e.startsWith('heygen:'))) return false
  const regResult = await registerHeyGenWebhook(heygenApiKey, SOPHIA_HEYGEN_WEBHOOK_URL)
  if (!regResult.success) {
    credErrors.push(`webhook: ${regResult.error ?? 'HeyGen webhook registration failed'}`)
    logger.warn('[SaveCredentials] HeyGen auto-register failed (non-fatal)', {
      userId,
      error: regResult.error,
    })
    return false
  }
  if (regResult.signingSecret) {
    try {
      await setUserCredential(userId, 'heygen_webhook_secret', regResult.signingSecret)
    } catch (err) {
      logger.warn('[SaveCredentials] Failed to auto-store heygen_webhook_secret', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return true
}

async function markOnboardingCompleteAndWelcome(
  user: { id: string; email?: string; full_name?: string },
  routingStrategy: SaveCredentialsInput['routing_strategy'],
): Promise<void> {
  try {
    const _db = await getD1()
    if (!_db) throw new Error('D1 unavailable')
    const db = _db
    const nowMs = Date.now()
    await db
      .prepare('UPDATE user_profiles SET onboarding_completed_at = ?, settings = json_set(COALESCE(settings, \'{}\'), \'$.routing_strategy\', ?1) WHERE user_id = ?2')
      .bind(routingStrategy ?? 'priority', nowMs, user.id)
      .run()

    if (!user.email) return
    try {
      const already = await db
        .prepare('SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1')
        .bind(user.id, 'setup-complete')
        .first<{ 1: number }>()
      if (!already) {
        const ownerName = user.full_name ?? user.email.split('@')[0]
        await enqueueWelcomeEmail(db, {
          paymentId: `lifecycle_${user.id}_setup-complete`,
          toEmail: user.email,
          template: 'setup-complete',
          payload: { ownerFullName: ownerName, locale: 'en' },
        })
        await db
          .prepare('INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)')
          .bind(user.id, 'setup-complete', nowMs)
          .run()
      }
    } catch (emailErr) {
      logger.warn('[SaveCredentials] Failed to enqueue setup-complete email', {
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      })
    }
  } catch (dbErr) {
    logger.warn('[SaveCredentials] Failed to set onboarding_completed_at', { error: dbErr })
  }
}

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

  const saves = buildSaveList(parsed.data)
  if (saves.length === 0) {
    return NextResponse.json({ success: false, message: 'No credentials provided' }, { status: 400 })
  }

  const credErrors: string[] = []
  for (const { provider, key } of saves) {
    try {
      await setUserCredential(user.id, provider, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      credErrors.push(`${provider}: ${msg}`)
    }
  }

  const webhookRegistered = await handleHeyGenWebhookAutoRegister(
    user.id,
    parsed.data.heygen_api_key,
    credErrors,
  )

  if (credErrors.some((e) => !e.startsWith('webhook:'))) {
    return NextResponse.json(
      { success: false, message: credErrors.filter((e) => !e.startsWith('webhook:')).join('; ') },
      { status: 500 },
    )
  }

  await markOnboardingCompleteAndWelcome(user, parsed.data.routing_strategy)
  const webhookErrors = credErrors.filter((e) => e.startsWith('webhook:'))

  return NextResponse.json({
    success: true,
    saved: saves.map((s) => s.provider),
    webhook_registered: webhookRegistered,
    ...(webhookErrors.length > 0 ? { errors: webhookErrors } : {}),
  })
}
