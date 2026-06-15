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
} from '@/tree/byok/user-api-key-store'
import { track } from '@/land/signals/track'
import { D1Events } from '@/land/signals/d1-event-types'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import { globalRateLimiter, createRateLimitResponse } from '@/forest/middleware/rate-limiter'
import { validateProviderKey, sanitizeCredential, type ValidatorProvider } from '@/tree/byok/key-format-validators'

const PROVIDERS = ['openrouter', 'anthropic', 'elevenlabs', 'd-id', 'muapi', 'apollo', 'hunter'] as const

const PostSchema = z.object({
  provider: z.enum(PROVIDERS),
  key:      z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().min(10).max(500)),
}).superRefine((data, ctx) => {
  const validation = validateProviderKey(data.provider as ValidatorProvider, data.key)
  if (!validation.ok) {
    ctx.addIssue({ code: 'custom', path: ['key'], message: `Invalid ${data.provider} key format` })
  }
})

const DeleteSchema = z.object({
  provider: z.enum(PROVIDERS),
})

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = globalRateLimiter.checkLimit(`byok:read:${user.id}`, { intervalMs: 60_000, maxRequests: 60 })
  if (!rl.allowed) return createRateLimitResponse(rl)

  const providers = await listUserApiKeyProviders(user.id)
  return NextResponse.json({ providers })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = globalRateLimiter.checkLimit(`byok:write:${user.id}`, { intervalMs: 60_000, maxRequests: 20 })
  if (!rl.allowed) return createRateLimitResponse(rl)

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

  const validation = validateProviderKey(provider as ValidatorProvider, key)
  const finalKey = validation.ok && validation.autoEncoded ? validation.autoEncoded : key

  try {
    await setUserApiKey(user.id, provider as ByokProvider, finalKey)
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

  const rl = globalRateLimiter.checkLimit(`byok:delete:${user.id}`, { intervalMs: 60_000, maxRequests: 10 })
  if (!rl.allowed) return createRateLimitResponse(rl)

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
