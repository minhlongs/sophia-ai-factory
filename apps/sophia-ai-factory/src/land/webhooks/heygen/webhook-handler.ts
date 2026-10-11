/**
 * HeyGen Webhook Handler
 * Layer: land/webhooks/heygen
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { createServerClient } from '@/seed/db/client'
import { verifyWebhook } from '@/land/webhooks/signature'
import { resolveHeyGenWebhookSecret } from '@/land/webhooks/heygen-webhook-secret-resolver'
import { checkWebhookRateLimit } from '@/seed/security/webhook-rate-limiter'
import { resolveVideoId, type HeyGenWebhookPayload } from './types'
import { processHeyGenPayload } from './event-processor'

export async function handleHeyGenWebhook(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text()

  let payload: HeyGenWebhookPayload
  try {
    payload = JSON.parse(rawBody) as HeyGenWebhookPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const heygenJobId = resolveVideoId(payload)
  const rateLimitKey = `${clientIp}:${heygenJobId ?? 'no-job-id'}`

  if (!checkWebhookRateLimit(rateLimitKey)) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  const { secret, ownerUserId, isUserScoped } = await resolveHeyGenWebhookSecret(heygenJobId)

  if (isUserScoped && !ownerUserId) {
    logger.warn('[heygen-webhook] User-scoped secret but no owner resolved — refusing update', { heygenJobId })
    return NextResponse.json({ ok: true, ignored: 'no_owner' })
  }

  if (!secret) {
    logger.warn('[heygen-webhook] No webhook secret configured — cron-poll fallback active', {
      heygenJobId,
    })
    return NextResponse.json({ ok: true, mode: 'cron-poll-fallback' })
  }

  const sig =
    req.headers.get('signature') ??
    req.headers.get('x-heygen-signature') ??
    req.headers.get('heygen-signature') ??
    req.headers.get('x-signature') ??
    ''

  if (!sig) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 })
  }

  const valid = await verifyWebhook(rawBody, sig, secret, { toleranceSec: 300, acceptLegacy: true })
  if (!valid) {
    logger.warn('[heygen-webhook] Invalid signature', { heygenJobId })
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  // Dedup: skip if same event processed within 5 min
  if (heygenJobId) {
    const now = Math.floor(Date.now() / 1000)
    const fiveMinAgo = now - 300
    try {
      const db = createServerClient()
      const { data: recent } = (await db
        .from('videos')
        .select('id, updated_at')
        .eq('heygen_job_id', heygenJobId)
        .gte('updated_at', new Date(fiveMinAgo * 1000).toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()) as { data: { id: string; updated_at: string } | null }

      if (recent) {
        logger.info('[heygen-webhook] Dedup — recent event skipped', { heygenJobId, lastUpdated: recent.updated_at })
        return NextResponse.json({ ok: true, deduped: true })
      }
    } catch (err) {
      logger.warn('[heygen-webhook] Dedup check failed (non-fatal)', { heygenJobId, error: String(err) })
    }
  }

  return processHeyGenPayload(payload, heygenJobId, ownerUserId)
}
