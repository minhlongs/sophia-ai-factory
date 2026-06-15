/**
 * POST /api/setup-wizard/test-resend
 *
 * Tests a Resend API key by sending a test email to the user's own address.
 * Returns ok/fail without persisting the key.
 * Auth required.
 *
 * @module app/api/setup-wizard/test-resend
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'

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
  const toEmail = user.email
  if (!toEmail) {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'No email on user account',
      message_vi: 'Tài khoản không có địa chỉ email',
    }, { status: 422 })
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        from: 'Sophia AI <noreply@mekongmind.com>',
        to: [toEmail],
        subject: 'Sophia AI — Resend key test',
        html: '<p>Your Resend API key is working correctly. / Khóa Resend API của bạn hoạt động đúng.</p>',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (res.ok) {
      return NextResponse.json({
        ok: true,
        valid: true,
        message: `Test email sent to ${toEmail}`,
        message_vi: `Email kiểm tra đã gửi đến ${toEmail}`,
      })
    }
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        valid: false,
        message: 'Invalid Resend API key',
        message_vi: 'Khoá Resend API không hợp lệ',
      }, { status: 422 })
    }
    const errText = await res.text().catch(() => '')
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: `Resend returned ${res.status}: ${errText.slice(0, 100)}`,
        message_vi: `Resend trả về ${res.status}`,
      },
      { status: 422 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ok: false,
      valid: false,
      message: `Network error: ${msg}`,
      message_vi: `Lỗi mạng: ${msg}`,
    }, { status: 502 })
  }
}
