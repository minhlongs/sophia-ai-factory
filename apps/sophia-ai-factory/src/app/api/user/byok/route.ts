/**
 * /api/user/byok — Phase 8C user-facing BYOK admin
 *
 *   GET    → list providers the caller has a stored key for
 *   POST   → upsert { provider, key } (encrypted at rest via 4G-BYOK crypto)
 *   DELETE → clear { provider }
 *
 * Auth: getCurrentUser() required on all verbs. Plaintext keys cross the
 * wire on POST only; GET never returns key material. All set/clear actions
 * emit a signals_events audit row (provider only — no key bytes).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/better-auth-session'
import {
  setUserApiKey,
  clearUserApiKey,
  listUserApiKeyProviders,
  type ByokProvider,
} from '@/lib/byok/user-api-key-store'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { logger } from '@/lib/utils/logger-utility'

const PROVIDERS = ['openrouter', 'anthropic', 'elevenlabs', 'd-id'] as const

const PostSchema = z.object({
  provider: z.enum(PROVIDERS),
  key:      z.string().min(10).max(500),
})

const DeleteSchema = z.object({
  provider: z.enum(PROVIDERS),
})

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const providers = await listUserApiKeyProviders(user.id)
  return NextResponse.json({ providers })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { provider, key } = parsed.data

  try {
    await setUserApiKey(user.id, provider as ByokProvider, key)
  } catch (err) {
    logger.warn('[byok-admin] setUserApiKey failed', {
      userId:   user.id,
      provider,
      error:    err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Failed to store key' }, { status: 500 })
  }

  // Audit: provider only — never log plaintext key material.
  track(D1Events.BYOK_KEY_SET, user.id, { provider })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { provider } = parsed.data

  try {
    await clearUserApiKey(user.id, provider as ByokProvider)
  } catch (err) {
    logger.warn('[byok-admin] clearUserApiKey failed', {
      userId:   user.id,
      provider,
      error:    err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Failed to clear key' }, { status: 500 })
  }

  track(D1Events.BYOK_KEY_CLEARED, user.id, { provider })

  return NextResponse.json({ ok: true })
}
