import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Raw } from '@/seed/db/client';
import { manualPilotRefundIntakeSchema, receiveManualPilotRefundIntake } from '@/land/payments/manual-pilot/manual-pilot-refund-intake';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) return NextResponse.json({ error: 'Vui lòng đăng nhập / Sign in required' }, { status: 401 });
    let input: unknown;
    try { input = await request.json(); }
    catch { return NextResponse.json({ error: 'Dữ liệu không hợp lệ / Invalid JSON' }, { status: 400 }); }
    const parsed = manualPilotRefundIntakeSchema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'Yêu cầu không hợp lệ / Invalid refund instruction' }, { status: 400 });
    const result = await receiveManualPilotRefundIntake(await getD1Raw(), parsed.data, user.id);
    if (result.ok) return NextResponse.json(result.value);
    const status = result.error.code === 'NOT_FOUND' ? 404 : result.error.code === 'VALIDATION_ERROR' ? 400 : 503;
    return NextResponse.json({ code: result.error.code,
      error: 'Không thể tiếp nhận yêu cầu / Unable to receive refund request' }, { status });
  } catch {
    return NextResponse.json({ error: 'Dịch vụ tạm thời không khả dụng / Service temporarily unavailable' }, { status: 503 });
  }
}
