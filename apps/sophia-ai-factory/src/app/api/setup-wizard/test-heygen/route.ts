/**
 * POST /api/setup-wizard/test-heygen
 *
 * Tests a HeyGen API key by calling GET /v2/voices?limit=1.
 * Returns ok/fail without persisting the key.
 * Auth required.
 *
 * @module app/api/setup-wizard/test-heygen
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'

const HEYGEN_TEST_URL = 'https://api.heygen.com/v2/voices?limit=1'
const PING_TIMEOUT_MS = 8_000

const schema = z.object({
  api_key: z.string().min(1, 'api_key is required'),
})

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Validation error' },
      { status: 400 },
    )
  }

  const { api_key } = parsed.data

  try {
    const res = await fetch(HEYGEN_TEST_URL, {
      method: 'GET',
      headers: { 'X-Api-Key': api_key, accept: 'application/json' },
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    })

    if (res.ok) {
      return NextResponse.json({ ok: true, message: 'HeyGen key is valid' })
    }
    if (res.status === 401) {
      return NextResponse.json({ ok: false, message: 'Invalid HeyGen API key (401)' }, { status: 422 })
    }
    return NextResponse.json(
      { ok: false, message: `HeyGen returned ${res.status}` },
      { status: 422 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.includes('abort') || msg.includes('timeout') || msg.includes('TimeoutError')
    return NextResponse.json(
      { ok: false, message: isTimeout ? 'HeyGen ping timed out' : `Network error: ${msg}` },
      { status: 502 },
    )
  }
}
