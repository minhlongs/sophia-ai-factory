/**
 * POST /api/setup/local-mode/provision — Phase D
 *
 * Validates a customer's self-hosted mekongd tunnel endpoint + bearer,
 * health-checks the endpoint, encrypts the bearer, and persists both
 * to D1. Emits a local_mode_provisioned signal on success.
 *
 * Security:
 *   - Auth: getCurrentUserFromHeaders (Better Auth session required)
 *   - Hostname: Zod regex — only *.cashclaw.cc HTTPS URLs accepted
 *   - Bearer: never stored plaintext — AES-256-GCM via encryptSecret()
 *   - Health-check result: 200 or 401 both treated as "reachable"
 *     (mekongd may require auth — that is expected behavior)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session'
import { encryptSecret } from '@/tree/crypto/encrypt-secret'
import { track } from '@/lib/signals/track'
import { D1Events } from '@/lib/signals/d1-event-types'
import { logger } from '@/seed/utils/logger-utility'

// ── Constants ─────────────────────────────────────────────────────────────────

const HEALTH_CHECK_TIMEOUT_MS = 8_000
const HOSTNAME_REGEX = /^https:\/\/[a-z0-9-]+\.cashclaw\.cc$/

// ── Request schema ────────────────────────────────────────────────────────────

const ProvisionBodySchema = z.object({
  hostname: z.string().regex(HOSTNAME_REGEX, {
    message: 'hostname must match https://<subdomain>.cashclaw.cc',
  }),
  bearer: z.string().min(32).max(128),
})

// ── FNV-1a hash (32-bit) for non-PII hostname fingerprint ────────────────────

function fnv1a(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

// ── Health-check helper ───────────────────────────────────────────────────────

async function healthCheckMekongd(hostname: string, bearer: string): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

  try {
    const res = await fetch(`${hostname}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'any',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    })
    // 200 = healthy, 401 = auth issue but endpoint exists (also reachable)
    return res.status === 200 || res.status === 401
  } catch {
    // Network error, DNS failure, or timeout — not reachable
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const user = await getCurrentUserFromHeaders(request.headers)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = ProvisionBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { hostname, bearer } = parsed.data

  // 3. Health-check the endpoint
  const reachable = await healthCheckMekongd(hostname, bearer)
  if (!reachable) {
    return NextResponse.json({ error: 'local_mekongd_unreachable' }, { status: 503 })
  }

  // 4. Encrypt bearer
  let encrypted: string
  try {
    encrypted = await encryptSecret(bearer)
  } catch (err) {
    logger.warn('[provision] encryptSecret failed', { userId: user.id, error: String(err) })
    return NextResponse.json({ error: 'encryption_failed' }, { status: 500 })
  }

  // 5. Persist to D1
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    const db = env?.DB as D1Database | undefined
    if (!db) throw new Error('D1 binding not available')

    await db
      .prepare(
        'UPDATE users SET local_mode_endpoint=?, local_mode_bearer_encrypted=? WHERE id=?',
      )
      .bind(hostname, encrypted, user.id)
      .run()
  } catch (err) {
    logger.warn('[provision] D1 write failed', { userId: user.id, error: String(err) })
    return NextResponse.json({ error: 'd1_write_failed' }, { status: 503 })
  }

  // 6. Emit signal (fire-and-forget)
  track(D1Events.LOCAL_MODE_PROVISIONED, user.id, {
    user_id: user.id,
    hostname_hash: fnv1a(hostname),
  })

  return NextResponse.json({ ok: true, hostname }, { status: 200 })
}

// ── DELETE /api/setup/local-mode/provision — disable local mode ───────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const user = await getCurrentUserFromHeaders(request.headers)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Clear local_mode columns in D1
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env
    const db = env?.DB as D1Database | undefined
    if (!db) throw new Error('D1 binding not available')

    await db
      .prepare(
        'UPDATE users SET local_mode_endpoint=NULL, local_mode_bearer_encrypted=NULL WHERE id=?',
      )
      .bind(user.id)
      .run()
  } catch (err) {
    logger.warn('[provision] D1 disable failed', { userId: user.id, error: String(err) })
    return NextResponse.json({ error: 'd1_write_failed' }, { status: 503 })
  }

  // 3. Emit signal (fire-and-forget)
  track(D1Events.LOCAL_MODE_DISABLED, user.id, {
    user_id: user.id,
    reason: 'user_disabled',
  })

  return NextResponse.json({ ok: true, disabled: true }, { status: 200 })
}
