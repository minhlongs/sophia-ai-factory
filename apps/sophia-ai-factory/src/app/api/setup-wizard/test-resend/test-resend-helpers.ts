import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';

export const RESEND_TEST_WIZARD_SERVICE = 'resend-test-wizard';

export const testResendSchema = z.object({
  api_key: z.string().min(1, 'api_key is required'),
});

export async function sendResendTestEmail(
  apiKey: string,
  toEmail: string,
  keyRef?: string,
): Promise<NextResponse> {
  if (!shouldAllowRequest(RESEND_TEST_WIZARD_SERVICE, keyRef)) {
    return NextResponse.json({
      ok: false,
      valid: false,
      message: 'Service temporarily unavailable (circuit open)',
      message_vi: 'Dịch vụ tạm thời không khả dụng',
    }, { status: 503 });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Sophia AI <noreply@mekongmind.com>',
        to: [toEmail],
        subject: 'Sophia AI — Resend key test',
        html: '<p>Your Resend API key is working correctly. / Khóa Resend API của bạn hoạt động đúng.</p>',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      recordSuccess(RESEND_TEST_WIZARD_SERVICE, keyRef);
      return NextResponse.json({
        ok: true,
        valid: true,
        message: `Test email sent to ${toEmail}`,
        message_vi: `Email kiểm tra đã gửi đến ${toEmail}`,
      });
    }
    if (res.status === 401 || res.status === 403) {
      // Customer credential validation errors (401/403) must NOT record an AUTH_FAILURE
      // on the circuit breaker — otherwise a single typo locks the user (or other tenants)
      // into a 5-minute 503 circuit-open window. Rate-limiting already bounds probing.
      return NextResponse.json({
        ok: false,
        valid: false,
        message: 'Invalid Resend API key',
        message_vi: 'Khoá Resend API không hợp lệ',
      }, { status: 422 });
    }
    const errText = await res.text().catch((err) => {
      logger.warn('Failed to read response body', {
        error: String(err),
        context: 'POST /api/setup-wizard/test-resend',
      });
      return '';
    });
    if (res.status >= 500 || res.status === 429) {
      recordFailure(RESEND_TEST_WIZARD_SERVICE, classifyHttpStatus(res.status), keyRef);
    }
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: `Resend returned ${res.status}: ${errText.slice(0, 100)}`,
        message_vi: `Resend trả về ${res.status}`,
      },
      { status: 422 },
    );
  } catch (err) {
    recordFailure(RESEND_TEST_WIZARD_SERVICE, classifyError(err), keyRef);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      valid: false,
      message: `Network error: ${msg}`,
      message_vi: `Lỗi mạng: ${msg}`,
    }, { status: 502 });
  }
}
