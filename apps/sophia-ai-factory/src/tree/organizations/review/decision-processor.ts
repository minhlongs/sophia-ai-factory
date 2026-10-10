/**
 * Video Review Decision Processor
 *
 * Submits client decision: approves video or requests changes.
 * If approved, automatically triggers the social distribution pipeline hook.
 *
 * Layer: tree/organizations/review
 * Allowed imports: @/seed/*, @/tree/organizations/review/*
 */

import type { D1Database } from '@/seed/db/client';
import { sha256Hex, timingSafeEqual } from '@/seed/security/review-token';
import type {
  SubmitReviewDecisionInput,
  FeedbackComment,
} from '@/seed/types/agency-multitenancy';
import type { ReviewDbRow, ReviewDecisionResult } from './types';
import {
  validateTokenInput,
  parseFeedbackComments,
  checkIsExpired,
  evaluateDecisionTransition,
} from './criteria-evaluator';
import { triggerAutoPublishHook } from './action-dispatcher';

/**
 * Submits client decision: approves video or requests changes.
 * If approved, automatically triggers the social distribution pipeline hook.
 */
export async function submitReviewDecision(
  db: D1Database,
  input: SubmitReviewDecisionInput
): Promise<ReviewDecisionResult> {
  const { token, decision, feedbackNote, author } = input;
  const trimmedToken = validateTokenInput(token);

  if (decision !== 'approve' && decision !== 'request_changes') {
    throw new Error("VALIDATION_ERROR: Decision must be either 'approve' or 'request_changes'");
  }

  const tokenHash = await sha256Hex(trimmedToken);

  const row = await db
    .prepare('SELECT * FROM video_reviews WHERE token_hash = ?')
    .bind(tokenHash)
    .first<ReviewDbRow>();

  if (!row || !timingSafeEqual(row.token_hash, tokenHash)) {
    throw new Error('REVIEW_NOT_FOUND: Invalid review token');
  }

  if (checkIsExpired(row.expires_at)) {
    throw new Error('REVIEW_EXPIRED: This review link has expired');
  }

  const { isIdempotentApproval } = evaluateDecisionTransition(row.status, decision);
  if (isIdempotentApproval) {
    return {
      success: true,
      status: 'APPROVED',
      autoPublishTriggered: false,
      alreadyApproved: true,
    };
  }

  const comments: FeedbackComment[] = parseFeedbackComments(row.feedback_comments);

  if (feedbackNote?.trim()) {
    comments.push({
      author: author?.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer'),
      comment: feedbackNote.trim(),
      createdAt: new Date().toISOString(),
    });
  }

  const nextStatus = decision === 'approve' ? 'approved' : 'changes_requested';
  const now = new Date().toISOString();

  await db
    .prepare(`
      UPDATE video_reviews
      SET status = ?, feedback_comments = ?, reviewed_at = ?
      WHERE id = ?
    `)
    .bind(nextStatus, JSON.stringify(comments), now, row.id)
    .run();

  let autoPublishTriggered = false;
  let triggerResult;

  if (decision === 'approve') {
    triggerResult = await triggerAutoPublishHook(db, {
      subaccountId: row.subaccount_id,
      videoId: row.video_id,
      videoTitle: row.video_title ?? undefined,
    });
    autoPublishTriggered = triggerResult.dispatched;
  }

  return {
    success: true,
    status: decision === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED',
    autoPublishTriggered,
    triggerResult,
  };
}
