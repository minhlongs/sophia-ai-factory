/**
 * Client Video Review Portal State Management Hook
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/use-review-portal-state
 */

import { useState, useRef } from 'react';
import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy';
import type { ClientVideoReviewPortalProps, ReviewDecisionType } from './types';

export function useReviewPortalState(props: ClientVideoReviewPortalProps) {
  const {
    review: initialReview,
    locale: initialLocale = 'vi',
    onFeedbackSubmit,
    onDecisionSubmit,
  } = props;

  const [locale, setLocale] = useState<'en' | 'vi'>(initialLocale);
  const isVi = locale === 'vi';

  const [review, setReview] = useState<VideoReviewPayload>(initialReview);
  const [comments, setComments] = useState<FeedbackComment[]>(initialReview.feedbackComments || []);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [authorName, setAuthorName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [pinTimestamp, setPinTimestamp] = useState<boolean>(true);
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [activeModal, setActiveModal] = useState<ReviewDecisionType | null>(null);

  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const branding = review.subaccountBranding;
  const primaryColor = branding?.primaryColor || '#0f172a';
  const accentColor = branding?.accentColor || '#10b981';

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTimeSec(Math.floor(videoRef.current.currentTime));
    }
  };

  const seekTo = (seconds?: number) => {
    if (typeof seconds === 'number' && videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (onFeedbackSubmit) {
        await onFeedbackSubmit(newComment);
      } else {
        const res = await fetch(`/api/client-review/${review.token}`, {
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

      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      setFeedbackSuccess(
        isVi ? 'Đã gửi góp ý thành công!' : 'Feedback submitted successfully!'
      );
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDecision = async (decision: ReviewDecisionType) => {
    setIsSubmittingDecision(true);
    setErrorMessage(null);

    try {
      if (onDecisionSubmit) {
        await onDecisionSubmit(decision, decisionNote.trim());
      } else {
        const res = await fetch(`/api/client-review/${review.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'decision',
            decision,
            feedbackNote: decisionNote.trim(),
            author: authorName.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer'),
          }),
        });
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Failed to submit review decision');
        }
      }

      const nextStatus = decision === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
      setReview((prev) => ({ ...prev, status: nextStatus }));
      if (decisionNote.trim()) {
        setComments((prev) => [
          ...prev,
          {
            author: authorName.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer'),
            comment: decisionNote.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setActiveModal(null);
      setDecisionNote('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  return {
    locale,
    setLocale,
    isVi,
    review,
    comments,
    currentTimeSec,
    authorName,
    setAuthorName,
    commentText,
    setCommentText,
    pinTimestamp,
    setPinTimestamp,
    decisionNote,
    setDecisionNote,
    activeModal,
    setActiveModal,
    isSubmittingComment,
    isSubmittingDecision,
    feedbackSuccess,
    errorMessage,
    setErrorMessage,
    videoRef,
    branding,
    primaryColor,
    accentColor,
    handleTimeUpdate,
    seekTo,
    handleAddComment,
    handleDecision,
  };
}
