/**
 * Client Video Review Portal API Submission Helpers
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/review-portal-api
 */

import type { FeedbackComment } from '@/seed/types/agency-multitenancy';
import type { ReviewDecisionType } from './types';

export async function postReviewCommentRequest(
  token: string,
  newComment: FeedbackComment,
  onFeedbackSubmit?: (comment: FeedbackComment) => Promise<void>,
): Promise<void> {
  if (onFeedbackSubmit) {
    await onFeedbackSubmit(newComment);
    return;
  }

  const res = await fetch(`/api/client-review/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'comment',
      comment: newComment.comment,
      author: newComment.author,
      timestampSec: newComment.timestampSec,
    }),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || 'Failed to submit comment');
  }
}

export async function postReviewDecisionRequest(
  token: string,
  decision: ReviewDecisionType,
  feedbackNote: string,
  author: string,
  onDecisionSubmit?: (decision: ReviewDecisionType, note: string) => Promise<void>,
): Promise<void> {
  if (onDecisionSubmit) {
    await onDecisionSubmit(decision, feedbackNote);
    return;
  }

  const res = await fetch(`/api/client-review/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'decision',
      decision,
      feedbackNote,
      author,
    }),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || 'Failed to submit review decision');
  }
}
