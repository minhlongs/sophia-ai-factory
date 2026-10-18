/**
 * POST /api/setup-wizard/test-resend
 *
 * Tests a Resend API key by sending a test email to the user's own address.
 * Returns ok/fail without persisting the key.
 * Auth required.
 *
 * @module app/api/setup-wizard/test-resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { testResendSchema, sendResendTestEmail } from './test-resend-helpers';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'Unauthorized',
      message_vi: 'Chưa xác thực',
    }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'Invalid JSON',
      message_vi: 'JSON không hợp lệ',
    }, { status: 400 });
  }

  const parsed = testResendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        message_vi: 'Lỗi xác thực dữ liệu đầu vào',
      },
      { status: 400 },
    );
  }

  const { api_key } = parsed.data;
  const toEmail = user.email;
  if (!toEmail) {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'No email on user account',
      message_vi: 'Tài khoản không có địa chỉ email',
    }, { status: 422 });
  }

  return sendResendTestEmail(api_key, toEmail);
}
