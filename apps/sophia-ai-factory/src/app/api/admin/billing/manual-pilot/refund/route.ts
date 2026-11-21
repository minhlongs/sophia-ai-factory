import { transitionPilotRefund } from '@/land/payments/manual-pilot/manual-pilot-refund-transitions';
/** Recent-auth admin verification and evidenced manual-pilot refund lifecycle.
 * VN: Xác minh lỗi Option A; chỉ chứng cứ ngân hàng độc lập mới xác nhận đã hoàn tiền.
 * EN: Verification is not a payout; legacy reference-only confirmation fails closed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  manualPilotDeliveryVerificationSchema,
  verifyManualPilotDeliveryFailure,
} from '@/land/payments/manual-pilot/manual-pilot-delivery-evidence';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { invalidateOrgIdCache } from '@/seed/auth/org-resolver';
import { getD1Raw } from '@/seed/db/client';
import { invalidateUserTierCache } from '@/seed/db/get-user-tier';
import { success, type Result } from '@/seed/types/result';
import {
  confirmManualPilotRefund,
  manualPilotRefundSchema,
  requestManualPilotRefund,
  type ManualPilotError,
} from '@/land/payments/manual-pilot';

export const dynamic = 'force-dynamic';

const refundRouteSchema = z.union([
  manualPilotDeliveryVerificationSchema,
  manualPilotRefundSchema.and(z.object({ deliveryEvidenceId: z.string().min(1).max(128).optional() })),
]);

function mapErrorStatus(code: ManualPilotError['code']): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'INVALID_STATE':
      return 409;
    case 'AMOUNT_MISMATCH':
    case 'REFUND_WINDOW_EXCEEDED':
    case 'VALIDATION_ERROR':
      return 400;
    default:
      return 500;
  }
}

function financialResponse<T>(result: Result<T, ManualPilotError>) {
  if (result.ok) return NextResponse.json(result.value);
  return NextResponse.json({ error: result.error.message, code: result.error.code },
    { status: mapErrorStatus(result.error.code) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const parsed = refundRouteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let rawDb: Awaited<ReturnType<typeof getD1Raw>>;
  try {
    rawDb = await getD1Raw();
  } catch {
    return NextResponse.json({ error: 'Database unavailable', code: 'DB_ERROR' }, { status: 503 });
  }
  const data = parsed.data;

  if (data.action === 'verify_delivery_failure') {
    const result = await verifyManualPilotDeliveryFailure(rawDb, data, auth.user.id);
    return financialResponse(result);
  }

  if (data.action === 'request') {
    const result = await requestManualPilotRefund(rawDb, {
      intakeId: data.intakeId,
      orderId: data.orderId,
      adminId: auth.user.id,
      reason: data.reason,
      category: data.category,
      refundAmountVnd: data.refundAmountVnd,
      deliveryEvidenceId: data.deliveryEvidenceId,
      auditNotes: data.auditNotes,
    });
    return financialResponse(result.ok
      ? success({ status: 'refund_pending', settlement: result.value }) : result);
  }

  if(data.action !== 'confirm') {
    const target={approve:'APPROVED',transfer_pending:'TRANSFER_PENDING',settle:'SETTLED'} as const;
    const result=await transitionPilotRefund(rawDb,{orderId:data.orderId,adminId:auth.user.id,
      target:target[data.action],evidenceId:data.action==='settle'?data.evidenceId:undefined});
    if (!result.ok) return NextResponse.json({ error: result.error.message }, { status: 409 });
    return NextResponse.json(result.value);
  }
  const result = await confirmManualPilotRefund(rawDb, {
    orderId: data.orderId,
    adminId: auth.user.id,
    refundExternalRef: data.refundExternalRef,
    auditNotes: data.auditNotes,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: mapErrorStatus(result.error.code) },
    );
  }

  invalidateOrgIdCache(result.value.user_id);
  invalidateUserTierCache(result.value.user_id);

  return NextResponse.json({ status: 'refunded', settlement: result.value });
}
