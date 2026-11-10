/**
 * GET / POST /api/admin/affiliate-payouts — OCC-guarded affiliate payout approvals.
 * @module app/api/admin/affiliate-payouts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/seed/auth/require-admin';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import { approvePayout, listPendingApprovalPayouts, rejectPayout } from './route-helpers';

export const dynamic = 'force-dynamic';
const MAX_LIST_ROWS = 200;

const decisionSchema = z.object({
  payoutId: z.string().min(1),
  currentVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(500).optional(),
});

async function guardAffiliatePayouts(adminId: string): Promise<NextResponse | null> {
  const gate = await enforceCommercialFeatureForUser(adminId, 'operator_affiliate_payout_admin');
  return gate.ok
    ? null
    : NextResponse.json({ error: 'FEATURE_LOCKED', message: gate.error.message }, { status: 403 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const locked = await guardAffiliatePayouts(auth.user.id);
  if (locked) return locked;

  try {
    const d1 = await getD1();
    if (!d1) return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    const payouts = await listPendingApprovalPayouts(d1, MAX_LIST_ROWS);
    return NextResponse.json({ payouts, count: payouts.length });
  } catch (err) {
    logger.error('[admin/affiliate-payouts] List failed', toError(err));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const locked = await guardAffiliatePayouts(auth.user.id);
  if (locked) return locked;

  let body: z.infer<typeof decisionSchema>;
  try {
    body = decisionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request', details: 'Invalid request payload' }, { status: 400 });
  }

  if (body.decision === 'reject' && !body.reason) {
    return NextResponse.json({ error: 'rejection_reason_required' }, { status: 422 });
  }

  try {
    const d1 = await getD1();
    if (!d1) return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });

    const result = body.decision === 'approve'
      ? await approvePayout({ d1, payoutId: body.payoutId, currentVersion: body.currentVersion, adminId: auth.user.id })
      : await rejectPayout({
          d1,
          payoutId: body.payoutId,
          currentVersion: body.currentVersion,
          adminId: auth.user.id,
          reason: body.reason ?? '',
        });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.conflict ? 'version_conflict' : 'internal_error' },
        { status: result.conflict ? 409 : 500 },
      );
    }

    await logAuditEvent({
      action: `affiliate_payout.${body.decision}`,
      userId: auth.user.id,
      metadata: {
        payoutId: body.payoutId,
        previousVersion: body.currentVersion,
        reason: body.reason ?? null,
        actorType: 'admin',
      },
    });
    logger.info('[admin/affiliate-payouts] Decision recorded', {
      payoutId: body.payoutId,
      decision: body.decision,
      adminId: auth.user.id,
    });
    return NextResponse.json({ ok: true, decision: body.decision });
  } catch (err) {
    logger.error('[admin/affiliate-payouts] Decision failed', toError(err));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
