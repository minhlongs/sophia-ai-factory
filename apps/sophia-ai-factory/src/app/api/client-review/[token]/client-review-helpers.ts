/**
 * Client Video Review API Helpers
 *
 * @module app/api/client-review/[token]/client-review-helpers
 */

import { NextResponse } from 'next/server';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import {
  addReviewFeedback,
  submitReviewDecision,
} from '@/tree/organizations/review-service';
import type { D1Database } from '@cloudflare/workers-types';

export interface ClientReviewPostBody {
  action?: 'comment' | 'decision';
  comment?: string;
  author?: string;
  timestampSec?: number;
  decision?: 'approve' | 'request_changes';
  feedbackNote?: string;
}

export async function guardAgencyReviewPortal(
  db?: D1Database | null,
  token?: string,
): Promise<NextResponse | null> {
  let ownerUserId: string | undefined;
  if (db && token?.trim()) {
    try {
      const row = await db
        .prepare(
          `SELECT om.user_id AS ownerUserId
             FROM video_reviews vr
             JOIN client_subaccounts cs ON cs.id = vr.subaccount_id
             JOIN org_members om ON om.org_id = cs.agency_org_id
            WHERE vr.review_token = ?1
              AND om.role IN ('owner', 'admin')
            ORDER BY CASE WHEN om.role = 'owner' THEN 0 ELSE 1 END
            LIMIT 1`,
        )
        .bind(token.trim())
        .first<{ ownerUserId: string }>();
      ownerUserId = row?.ownerUserId;
    } catch {
      ownerUserId = undefined;
    }
  }

  const gate = await enforceCommercialFeatureForUser(
    ownerUserId ?? 'agency-review-portal',
    'white_label_agency_portal',
    ownerUserId ? undefined : { resolvedTier: 'ENTERPRISE' },
  );
  if (!gate.ok) {
    return NextResponse.json(
      { error: 'FEATURE_LOCKED', message: gate.error.message },
      { status: 403 },
    );
  }
  return null;
}

export function mapGetReviewError(err: unknown): Response {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('REVIEW_NOT_FOUND')) {
    return NextResponse.json({ error: 'Review link not found or invalid' }, { status: 404 });
  }
  if (message.startsWith('VALIDATION_ERROR:') || message.startsWith('INVALID_TOKEN:')) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function mapPostReviewError(err: unknown): Response {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('REVIEW_NOT_FOUND')) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }
  if (message.includes('REVIEW_EXPIRED')) {
    return NextResponse.json({ error: 'Review link has expired' }, { status: 410 });
  }
  if (message.includes('ALREADY_APPROVED')) {
    return NextResponse.json(
      { error: 'ALREADY_APPROVED: Video has already been approved and scheduled for publishing' },
      { status: 409 },
    );
  }
  if (message.startsWith('VALIDATION_ERROR:') || message.startsWith('INVALID_TOKEN:')) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function dispatchReviewPostAction(
  db: D1Database,
  token: string,
  body: ClientReviewPostBody,
): Promise<Response> {
  if (body.action === 'comment') {
    if (!body.comment?.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }
    const updatedComments = await addReviewFeedback(db, {
      token, comment: body.comment, author: body.author, timestampSec: body.timestampSec,
    });
    return NextResponse.json({ success: true, comments: updatedComments });
  }

  if (body.action === 'decision') {
    if (!body.decision || (body.decision !== 'approve' && body.decision !== 'request_changes')) {
      return NextResponse.json(
        { error: "Valid decision ('approve' or 'request_changes') is required" },
        { status: 400 },
      );
    }
    const result = await submitReviewDecision(db, {
      token, decision: body.decision, feedbackNote: body.feedbackNote, author: body.author,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json(
    { error: "Invalid action. Expected 'comment' or 'decision'" },
    { status: 400 },
  );
}
