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
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'Unauthorized',
      message_vi: 'Chưa xác thực',
    }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'Invalid JSON',
      message_vi: 'JSON không hợp lệ',
    }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        message_vi: 'Lỗi xác thực dữ liệu đầu vào',
      },
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
      return NextResponse.json({
        ok: true,
        valid: true,
        message: 'HeyGen key is valid',
        message_vi: 'Khoá HeyGen hợp lệ',
      })
    }
    if (res.status === 401) {
      return NextResponse.json({
        ok: false,
        valid: false,
        message: 'Invalid HeyGen API key (401)',
        message_vi: 'Khoá HeyGen không hợp lệ (401)',
      }, { status: 422 })
    }
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: `HeyGen returned ${res.status}`,
        message_vi: `HeyGen trả về ${res.status}`,
      },
      { status: 422 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.includes('abort') || msg.includes('timeout') || msg.includes('TimeoutError')
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: isTimeout ? 'HeyGen ping timed out' : `Network error: ${msg}`,
        message_vi: isTimeout ? 'Kết nối HeyGen hết thời gian' : `Lỗi mạng: ${msg}`,
      },
      { status: 502 },
    )
  }
}
