/**
 * POST /api/setup-wizard/validate-key
 * Real provider health check probe for Setup Wizard BYOK credentials.
 * Calls upstream lightweight endpoints with a strict 5s timeout. Fail-closed. Zero key logging.
 *
 * @module app/api/setup-wizard/validate-key/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { probeProviderApiKey } from '@/tree/byok/provider-probe';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  provider: z.string().min(1, 'provider is required'),
  api_key: z.string().min(1, 'api_key is required'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Unauthorized', message_vi: 'Chưa đăng nhập' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, valid: false, message: 'Invalid JSON', message_vi: 'Dữ liệu JSON không hợp lệ' },
      { status: 400 },
    );
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message: parsed.error.issues[0]?.message ?? 'Validation error',
        message_vi: 'Lỗi xác thực thông tin đầu vào',
      },
      { status: 400 },
    );
  }

  const { provider, api_key } = parsed.data;
  const result = await probeProviderApiKey(provider, api_key);

  if (result.valid) {
    return NextResponse.json(result, { status: 200 });
  }

  if (result.status === 'UNKNOWN' || result.httpStatus === 400) {
    return NextResponse.json(result, { status: 400 });
  }

  const isAuthFail = result.httpStatus === 401 || result.httpStatus === 403;
  return NextResponse.json(result, { status: isAuthFail ? 422 : 502 });
}
