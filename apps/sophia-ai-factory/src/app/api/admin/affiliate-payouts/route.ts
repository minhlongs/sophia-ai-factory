/**
 * GET  /api/admin/affiliate-payouts — list payouts awaiting admin approval
 * POST /api/admin/affiliate-payouts — approve or reject a payout
 *
 * Admin-only. Rejection requires a reason, which is stamped onto the payout
 * row so the partner-facing reason is durable rather than living only in a
 * log line. Both transitions are OCC-guarded on `version`.
 *
 * @module app/api/admin/affiliate-payouts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/seed/auth/require-admin';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import {
  approvePayout,
  listPendingApprovalPayouts,
  rejectPayout,
} from './route-helpers';

export const dynamic = 'force-dynamic';

const decisionSchema = z.object({
  payoutId: z.string().min(1),
  currentVersion: z.number().int().positive(),
  decision: z.enum(['approve', 'reject']),
  /** Mandatory on reject: the partner sees this reason. */
  reason: z.string().trim().min(3).max(500).optional(),
});

const MAX_LIST_ROWS = 200;

/**
 * GET — pending approvals, largest first so the highest-risk claims are
 * reviewed before smaller ones.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }

    const payouts = await listPendingApprovalPayouts(d1, MAX_LIST_ROWS);
    return NextResponse.json({ payouts, count: payouts.length });
  } catch (err) {
    logger.error('[admin/affiliate-payouts] List failed', toError(err));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

/**
 * POST — approve or reject a single payout. A reject without a reason is a
 * validation error, because a partner cannot act on an unexplained rejection.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: z.infer<typeof decisionSchema>;
  try {
    body = decisionSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_request', details: toError(err).message },
      { status: 400 },
    );
  }

  if (body.decision === 'reject' && !body.reason) {
    return NextResponse.json(
      { error: 'rejection_reason_required' },
      { status: 422 },
    );
  }

  try {
    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'DATABASE_UNAVAILABLE' }, { status: 503 });
    }

    const result = body.decision === 'approve'
      ? await approvePayout({
          d1,
          payoutId: body.payoutId,
          currentVersion: body.currentVersion,
          adminId: auth.user.id,
        })
      : await rejectPayout({
          d1,
          payoutId: body.payoutId,
          currentVersion: body.currentVersion,
          adminId: auth.user.id,
          reason: body.reason ?? '',
        });

    if (!result.ok) {
      const status = result.conflict ? 409 : 500;
      return NextResponse.json(
        { error: result.conflict ? 'version_conflict' : 'internal_error' },
        { status },
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
