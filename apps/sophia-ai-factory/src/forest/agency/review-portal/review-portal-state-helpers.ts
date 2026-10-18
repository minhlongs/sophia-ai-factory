'use client';

/**
 * State hook base for Review Portal.
 * Layer: forest/agency/review-portal
 * @module forest/agency/review-portal/review-portal-state-helpers
 */

import { useState, useRef } from 'react';
import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy';

export function useReviewPortalStateBase(props: {
  review: VideoReviewPayload;
  locale?: 'en' | 'vi';
  onFeedbackSubmit?: (comment: FeedbackComment) => Promise<void>;
  onDecisionSubmit?: (decision: 'approve' | 'changes' | 'request_changes', note?: string) => Promise<void>;
}) {
  const { review: initialReview, locale: initialLocale = 'vi', onFeedbackSubmit, onDecisionSubmit } = props;

  const [locale, setLocale] = useState<'en' | 'vi'>(initialLocale);
  const isVi = locale === 'vi';

  const [review, setReview] = useState<VideoReviewPayload>(initialReview);
  const [comments, setComments] = useState<FeedbackComment[]>(initialReview.feedbackComments || []);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [authorName, setAuthorName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [pinTimestamp, setPinTimestamp] = useState<boolean>(true);
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'approve' | 'changes' | 'request_changes' | null>(null);

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

  return {
    locale, setLocale, isVi, review, comments, currentTimeSec,
    authorName, setAuthorName, commentText, setCommentText,
    pinTimestamp, setPinTimestamp, decisionNote, setDecisionNote,
    activeModal, setActiveModal, isSubmittingComment, setIsSubmittingComment,
    isSubmittingDecision, setIsSubmittingDecision,
    feedbackSuccess, setFeedbackSuccess, errorMessage, setErrorMessage, videoRef,
    branding, primaryColor, accentColor,
    handleTimeUpdate, seekTo,
    setComments, setReview,
  };
}