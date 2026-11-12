/**
 * /api/publish-approvals/[id] — Publish Approval Resolution REST API
 *
 * PATCH — Approve or reject a publish that is waiting for a human decision.
 *
 * Auth: session-based via getCurrentUser(). The reviewer must hold the ADMIN
 * role in the workspace the publish belongs to, because an approval releases
 * media to a public channel — the same authority bar the agent-approval route
 * applies for the same reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';
import {
  getPublishLedgerRecordByKey,
  resolveAndAnnouncePublishApproval,
} from '@/tree/publishing/approval';

export const dynamic = 'force-dynamic';

const complianceSchema = z
  .object({
    privacyLevel: z
      .enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'])
      .optional(),
    brandOrganicToggle: z.boolean().optional(),
    brandContentToggle: z.boolean().optional(),
    containsSyntheticMedia: z.boolean().optional(),
  })
  .optional();

const resolveSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(2000).optional(),
  compliance: complianceSchema,
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      );
    }

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { id } = await params;
    // Read the row before touching it: it carries the workspace the authority
    // check runs against, so a reviewer cannot be authorized against a tenant
    // they invent in the request body.
    const record = await getPublishLedgerRecordByKey(id, d1);
    if (!record) {
      return NextResponse.json({ error: 'Publish approval not found' }, { status: 404 });
    }

    if (record.decision !== 'pending') {
      return NextResponse.json(
        {
          error: 'This publish approval was already resolved',
          decision: record.decision,
          resolved: false,
          alreadyResolved: true,
        },
        { status: 409 },
      );
    }

    const isReviewer = await verifyWorkspaceRole(record.tenantId, user.id, 'ADMIN', d1);
    if (!isReviewer) {
      return NextResponse.json(
        { error: 'Only workspace owner or admin can resolve publish approvals' },
        { status: 403 },
      );
    }

    if (
      parsed.data.approved &&
      record.platform.toLowerCase() === 'tiktok' &&
      parsed.data.compliance &&
      !parsed.data.compliance.privacyLevel
    ) {
      return NextResponse.json(
        { error: 'TikTok publish approval requires explicit privacyLevel selection' },
        { status: 400 },
      );
    }

    const outcome = await resolveAndAnnouncePublishApproval({
      tenantId: record.tenantId,
      channelId: record.channelId,
      platform: record.platform,
      mediaRef: record.mediaRef,
      decision: parsed.data.approved ? 'approved' : 'rejected',
      reviewerId: user.id,
      comment: parsed.data.comment,
      compliance: parsed.data.compliance,
      db: d1,
    });

    if (outcome.error) {
      logger.error('publishApproval: resolution failed', {
        idempotencyKey: id,
        code: outcome.error,
      });
      return NextResponse.json({ error: outcome.error }, { status: 500 });
    }

    if (outcome.alreadyResolved) {
      return NextResponse.json({
        error: 'This publish approval was already resolved',
        resolved: false,
        alreadyResolved: true,
      }, { status: 409 });
    }

    // "Was this your own work?" needs a person to compare against. A row with no
    // requester cannot answer it, so the answer is reported as unattributed
    // rather than as a confident "not yours" that a reviewer would read as a
    // second opinion.
    const attribution = record.requesterId ? 'attributed' : 'unattributed';
    const isSelfApproval = record.requesterId === user.id;
    logger.info('publishApproval: reviewer resolved a pending publish', {
      idempotencyKey: id,
      decision: parsed.data.approved ? 'approved' : 'rejected',
      reviewerId: user.id,
      requesterId: record.requesterId,
      selfApproval: isSelfApproval,
      attribution,
    });

    return NextResponse.json({
      resolved: true,
      alreadyResolved: false,
      decision: parsed.data.approved ? 'approved' : 'rejected',
      selfApproval: isSelfApproval,
      attribution,
      id,
      ...(parsed.data.compliance ? { compliance: parsed.data.compliance } : {}),
    });
  } catch (err) {
    // Log the cause server-side and return a stable code: the raw D1 message
    // can expose SQL fragments and schema names to the caller.
    logger.error('publishApproval: resolution threw', {
      error: getErrorMessage(err),
    });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
