'use client';

/**
 * Event handlers for Review Portal.
 * Layer: forest/agency/review-portal
 * @module forest/agency/review-portal/review-portal-handlers
 */

import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy';
import { postReviewCommentRequest, postReviewDecisionRequest } from './review-portal-api';

export async function handleAddComment(
  props: {
    review: VideoReviewPayload;
    authorName: string;
    commentText: string;
    pinTimestamp: boolean;
    currentTimeSec: number;
    isVi: boolean;
    onFeedbackSubmit?: (comment: FeedbackComment) => Promise<void>;
    setComments: (updater: (prev: FeedbackComment[]) => FeedbackComment[]) => void;
    setCommentText: (text: string) => void;
    setFeedbackSuccess: (text: string | null) => void;
    setErrorMessage: (text: string | null) => void;
    setIsSubmittingComment: (val: boolean) => void;
  }
) {
  const { review, authorName, commentText, pinTimestamp, currentTimeSec, isVi, onFeedbackSubmit, setComments, setCommentText, setFeedbackSuccess, setErrorMessage, setIsSubmittingComment } = props;
  if (!commentText.trim()) return;

  setIsSubmittingComment(true);
  setErrorMessage(null);
  setFeedbackSuccess(null);

  const newComment: FeedbackComment = {
    author: authorName.trim() || (isVi ? 'Khách hàng' : 'Client Reviewer'),
    comment: commentText.trim(),
    timestampSec: pinTimestamp ? currentTimeSec : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await postReviewCommentRequest(review.token, newComment, onFeedbackSubmit);
    setComments((prev) => [...prev, newComment]);
    setCommentText('');
    setFeedbackSuccess(isVi ? 'Đã gửi góp ý thành công!' : 'Feedback submitted successfully!');
    setTimeout(() => setFeedbackSuccess(null), 4000);
  } catch (err: unknown) {
    setErrorMessage(err instanceof Error ? err.message : String(err));
  } finally {
    setIsSubmittingComment(false);
  }
}

export async function handleDecision(
  props: {
    review: VideoReviewPayload;
    decision: 'approve' | 'changes' | 'request_changes';
    decisionNote: string;
    authorName: string;
    isVi: boolean;
    onDecisionSubmit?: (decision: 'approve' | 'changes' | 'request_changes', note?: string) => Promise<void>;
    setReview: (updater: (prev: VideoReviewPayload) => VideoReviewPayload) => void;
    setComments: (updater: (prev: FeedbackComment[]) => FeedbackComment[]) => void;
    setActiveModal: (val: 'approve' | 'changes' | 'request_changes' | null) => void;
    setDecisionNote: (text: string) => void;
    setErrorMessage: (text: string | null) => void;
    setIsSubmittingDecision: (val: boolean) => void;
  }
) {
  const { review, decision, decisionNote, authorName, isVi, onDecisionSubmit, setReview, setComments, setActiveModal, setDecisionNote, setErrorMessage, setIsSubmittingDecision } = props;
  setIsSubmittingDecision(true);
  setErrorMessage(null);
  const resolvedAuthor = authorName.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer');

  try {
    await postReviewDecisionRequest(review.token, decision, decisionNote.trim(), resolvedAuthor, onDecisionSubmit);

    const nextStatus = decision === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
    setReview((prev) => ({ ...prev, status: nextStatus }));
    if (decisionNote.trim()) {
      setComments((prev) => [
        ...prev,
        {
          author: resolvedAuthor,
          comment: decisionNote.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setActiveModal(null);
    setDecisionNote('');
  } catch (err: unknown) {
    setErrorMessage(err instanceof Error ? err.message : String(err));
  } finally {
    setIsSubmittingDecision(false);
  }
}
