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
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import {
  setUserApiKey,
  clearUserApiKey,
  listUserApiKeyProviders,
  type ByokProvider,
} from '@/lib/byok/user-api-key-store'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

const PROVIDERS = ['openrouter', 'anthropic', 'elevenlabs', 'd-id', 'muapi'] as const

const PROVIDER_KEY_RX: Record<string, RegExp> = {
  openrouter: /^sk-or-v1-[A-Za-z0-9_-]{20,}$/,
  anthropic:  /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  elevenlabs: /^[A-Za-z0-9_-]{20,}$/,
  'd-id':     /^[A-Za-z0-9+/=:_-]{20,}$/,
  muapi:      /^[A-Za-z0-9_-]{20,}$/,
}

const PostSchema = z.object({
  provider: z.enum(PROVIDERS),
  key:      z.string().min(10).max(500),
}).superRefine((data, ctx) => {
  const rx = PROVIDER_KEY_RX[data.provider]
  if (rx && !rx.test(data.key)) {
    ctx.addIssue({ code: 'custom', path: ['key'], message: `Invalid ${data.provider} key format` })
  }
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
    const flat = parsed.error.flatten()
    const fieldError = flat.fieldErrors.key?.[0] ?? flat.fieldErrors.provider?.[0] ?? 'Invalid request'
    return NextResponse.json({ error: fieldError, details: flat }, { status: 400 })
  }

  const { provider, key } = parsed.data

  try {
    await setUserApiKey(user.id, provider as ByokProvider, key)
  } catch (err) {
    logger.warn('[byok-admin] setUserApiKey failed', {
      userId:   user.id,
      provider,
      error:    getErrorMessage(err),
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
    const flat = parsed.error.flatten()
    const fieldError = flat.fieldErrors.provider?.[0] ?? 'Invalid request'
    return NextResponse.json({ error: fieldError, details: flat }, { status: 400 })
  }

  const { provider } = parsed.data

  try {
    await clearUserApiKey(user.id, provider as ByokProvider)
  } catch (err) {
    logger.warn('[byok-admin] clearUserApiKey failed', {
      userId:   user.id,
      provider,
      error:    getErrorMessage(err),
    })
    return NextResponse.json({ error: 'Failed to clear key' }, { status: 500 })
  }

  track(D1Events.BYOK_KEY_CLEARED, user.id, { provider })

  return NextResponse.json({ ok: true })
}
