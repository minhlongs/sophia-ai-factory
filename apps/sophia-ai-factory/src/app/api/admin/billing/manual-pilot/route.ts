import { sendCommittedManualPilotReceipt } from '@/land/payments/manual-pilot/manual-pilot-receipt';
import { transitionManualPilot } from '@/land/payments/manual-pilot/manual-pilot-transitions';
import { getManualPilotSettlementByOrderId } from '@/land/payments/manual-pilot/manual-pilot-repo';
/**
 * Privileged Admin API for Manual Bank Pilot Reconciliation & Once-Only Activation (G3).
 *
 * Security:
 * - GET guarded by requireAdmin (authenticated operator/founder only).
 * - POST guarded by requireAdminWithRecentAuth (step-up auth required for money/entitlement mutations).
 * - Zero unauthenticated or customer self-activation paths.
 *
 * @module app/api/admin/billing/manual-pilot/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { invalidateOrgIdCache } from '@/seed/auth/org-resolver';
import { getD1Raw } from '@/seed/db/client';
import { invalidateUserTierCache } from '@/seed/db/get-user-tier';
import { resolvePilotBankConfig } from '@/seed/config/pilot-bank-config';
import {
  approveAndActivateManualPilot,
  listManualPilotSettlements,
  reconcileManualPilotSchema,
  rejectManualPilotSettlement,
  type ManualPilotError,
  type ManualPilotStatus,
} from '@/land/payments/manual-pilot';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set<ManualPilotStatus>([
  'pending_manual_payment',
  'under_review',
  'activated',
  'rejected',
  'refund_pending',
  'refunded',
]);

function mapErrorStatus(code: ManualPilotError['code']): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE_SETTLEMENT':
    case 'DUPLICATE_BANK_REF':
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const statusParam = request.nextUrl.searchParams.get('status');
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '50');
  const status =
    statusParam && VALID_STATUSES.has(statusParam as ManualPilotStatus)
      ? (statusParam as ManualPilotStatus)
      : undefined;

  const rawDb = await getD1Raw();
  const [settlements, bankConfig] = await Promise.all([
    listManualPilotSettlements(rawDb, {
      scope: { adminId: auth.user.id },
      status,
      limit: Number.isFinite(limitParam) ? limitParam : 50,
    }),
    resolvePilotBankConfig(),
  ]);

  return NextResponse.json({
    settlements,
    bankConfigStatus: {
      configured: bankConfig.configured,
      transferPrefix: bankConfig.transferPrefix,
    },
  });
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

  const parsed = reconcileManualPilotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const rawDb = await getD1Raw();
  const data = parsed.data;

  if (data.action === 'reject') {
    const result = await rejectManualPilotSettlement(rawDb, {
      orderId: data.orderId,
      adminId: auth.user.id,
      auditNotes: data.auditNotes,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message, code: result.error.code },
        { status: mapErrorStatus(result.error.code) },
      );
    }
    return NextResponse.json({ status: 'rejected', settlement: result.value });
  }

  if (data.action !== 'approve_and_activate') {
    const order=await getManualPilotSettlementByOrderId(rawDb,data.orderId,{adminId:auth.user.id});
    if(!order?.org_id || !data.evidenceId) return NextResponse.json({error:'Bound tenant and independent evidence required'},{status:400});
    const target={verify_settlement:'BANK_SETTLEMENT_VERIFIED',reconcile:'RECONCILED',approve:'ADMIN_APPROVED'} as const;
    const result=await transitionManualPilot(rawDb,{orderId:data.orderId,orgId:order.org_id,
      adminId:auth.user.id,evidenceId:data.evidenceId,target:target[data.action]});
    return NextResponse.json(result.ok ? result.value : {error:result.error.message},{status:result.ok?200:409});
  }

  const result = await approveAndActivateManualPilot(rawDb, {
    orderId: data.orderId,
    adminId: auth.user.id,
    receivedAmountVnd: data.receivedAmountVnd ?? 0,
    bankTransactionRef: data.bankTransactionRef ?? '',
    payerNote: data.payerNote,
    auditNotes: data.auditNotes,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, code: result.error.code },
      { status: mapErrorStatus(result.error.code) },
    );
  }

  await sendCommittedManualPilotReceipt(rawDb, result.value.order_id, result.value.user_id);

  invalidateOrgIdCache(result.value.user_id);
  invalidateUserTierCache(result.value.user_id);

  return NextResponse.json({
    status: 'activated',
    settlement: result.value,
  });
}
