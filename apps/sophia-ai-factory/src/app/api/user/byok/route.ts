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
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store'
import { globalRateLimiter, createRateLimitResponse } from '@/forest/middleware/rate-limiter'
import {
  DeleteSchema,
  PostSchema,
  removeUserByokKey,
  upsertVerifiedByokKey,
} from './byok-route-helpers'

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = globalRateLimiter.checkLimit(`byok:read:${user.id}`, {
    intervalMs: 60_000,
    maxRequests: 60,
  })
  if (!rl.allowed) return createRateLimitResponse(rl)

  const providers = await listUserApiKeyProviders(user.id)
  return NextResponse.json({ providers })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = globalRateLimiter.checkLimit(`byok:write:${user.id}`, {
    intervalMs: 60_000,
    maxRequests: 20,
  })
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
    const fieldError =
      flat.fieldErrors.key?.[0] ?? flat.fieldErrors.provider?.[0] ?? 'Invalid request'
    return NextResponse.json({ error: fieldError, details: flat }, { status: 400 })
  }

  const { provider, key, validateLive } = parsed.data
  return upsertVerifiedByokKey(user.id, provider, key, validateLive)
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = globalRateLimiter.checkLimit(`byok:delete:${user.id}`, {
    intervalMs: 60_000,
    maxRequests: 10,
  })
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

  return removeUserByokKey(user.id, parsed.data.provider)
}
