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

  const credErrors: string[] = []
  let webhookRegistered = false

  for (const { provider, key } of saves) {
    try {
      await setUserCredential(user.id, provider, key)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      credErrors.push(`${provider}: ${msg}`)
    }
  }

  // Auto-register HeyGen webhook when heygen_api_key is saved — fail-soft
  if (heygen_api_key && !credErrors.some((e) => e.startsWith('heygen:'))) {
    const regResult = await registerHeyGenWebhook(heygen_api_key, SOPHIA_HEYGEN_WEBHOOK_URL)
    if (regResult.success) {
      webhookRegistered = true
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
      // Non-blocking but surfaced to frontend via webhook_registered: false
      credErrors.push(`webhook: ${regResult.error ?? 'HeyGen webhook registration failed'}`)
      logger.warn('[SaveCredentials] HeyGen auto-register failed (non-fatal)', {
        userId: user.id,
        error: regResult.error,
      })
    }
  }

  if (credErrors.some((e) => !e.startsWith('webhook:'))) {
    return NextResponse.json(
      { success: false, message: credErrors.filter((e) => !e.startsWith('webhook:')).join('; ') },
      { status: 500 },
    )
  }

  // Mark onboarding complete in DB (primary) — cookie fallback handled by /api/setup/save
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 unavailable');
    const db = _db;
    const nowSec = Math.floor(Date.now() / 1000)
    await db
      .prepare('UPDATE user_profiles SET onboarding_completed_at = ? WHERE user_id = ?')
      .bind(nowSec, user.id)
      .run()

    // E2 setup-complete lifecycle email — fire ONCE per user (lifecycle_email_log dedup).
    // Multiple save-credentials POSTs are safe; only the first inserts the log row + enqueues.
    if (user.email) {
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
            .bind(user.id, 'setup-complete', nowSec)
            .run()
        }
      } catch (emailErr) {
        logger.warn('[SaveCredentials] Failed to enqueue setup-complete email', {
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        })
      }
    }
  } catch (dbErr) {
    logger.warn('[SaveCredentials] Failed to set onboarding_completed_at', { error: dbErr })
  }

  const webhookErrors = credErrors.filter((e) => e.startsWith('webhook:'))

  return NextResponse.json({
    success: true,
    saved: saves.map((s) => s.provider),
    webhook_registered: webhookRegistered,
    ...(webhookErrors.length > 0 ? { errors: webhookErrors } : {}),
  })
}
