'use client';

/**
 * Client Video Review Portal State Management Hook
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/use-review-portal-state
 */

import type { ClientVideoReviewPortalProps, ReviewDecisionType } from './types';
import { useReviewPortalStateBase } from './review-portal-state-helpers';
import { handleAddComment, handleDecision } from './review-portal-handlers';

export function useReviewPortalState(props: ClientVideoReviewPortalProps) {
  const baseState = useReviewPortalStateBase(props);

  const handleAddCommentWrapper = (e: React.FormEvent) => {
    handleAddComment({
      ...baseState,
      review: props.review,
      onFeedbackSubmit: props.onFeedbackSubmit,
      setComments: baseState.setComments,
      setCommentText: baseState.setCommentText,
      setFeedbackSuccess: baseState.setFeedbackSuccess,
      setErrorMessage: baseState.setErrorMessage,
      setIsSubmittingComment: baseState.setIsSubmittingComment,
    });
  };

  const handleDecisionWrapper = async (decision: ReviewDecisionType) => {
    await handleDecision({
      review: props.review,
      decision,
      decisionNote: baseState.decisionNote,
      authorName: baseState.authorName,
      isVi: baseState.isVi,
      onDecisionSubmit: props.onDecisionSubmit,
      setReview: baseState.setReview,
      setComments: baseState.setComments,
      setActiveModal: baseState.setActiveModal,
      setDecisionNote: baseState.setDecisionNote,
      setErrorMessage: baseState.setErrorMessage,
      setIsSubmittingDecision: baseState.setIsSubmittingDecision,
    });
  };

  return {
    ...baseState,
    handleAddComment: handleAddCommentWrapper,
    handleDecision: handleDecisionWrapper,
  };
}