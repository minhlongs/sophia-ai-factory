/**
 * Interactive Client Video Review & Approval Portal Main Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/client-video-review-portal
 */

'use client';

import React from 'react';
import type { ClientVideoReviewPortalProps } from './types';
import { useReviewPortalState } from './use-review-portal-state';
import { ReviewPortalHeader } from './portal-header';
import { ReviewStatusBanner } from './review-status-banner';
import { ReviewFeedbackAlerts } from './review-feedback-alerts';
import { VideoPlayerCard } from './video-player-card';
import { FeedbackTimelineCard } from './feedback-timeline-card';
import { ReviewDecisionModals } from './review-decision-modals';

export function ClientVideoReviewPortal(props: ClientVideoReviewPortalProps) {
  const state = useReviewPortalState(props);
  const {
    setLocale, isVi, review, comments, currentTimeSec,
    authorName, setAuthorName, commentText, setCommentText,
    pinTimestamp, setPinTimestamp, decisionNote, setDecisionNote,
    activeModal, setActiveModal, isSubmittingComment, isSubmittingDecision,
    feedbackSuccess, errorMessage, setErrorMessage, videoRef,
    branding, primaryColor, accentColor,
    handleTimeUpdate, seekTo, handleAddComment, handleDecision,
  } = state;

  const isApproved = review.status === 'APPROVED';
  const isChangesRequested = review.status === 'CHANGES_REQUESTED';
  const isExpired = review.isExpired;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans pb-16">
      <ReviewPortalHeader
        branding={branding}
        primaryColor={primaryColor}
        isVi={isVi}
        onToggleLocale={() => setLocale(isVi ? 'en' : 'vi')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <ReviewStatusBanner
          isExpired={isExpired}
          isApproved={isApproved}
          isChangesRequested={isChangesRequested}
          isVi={isVi}
        />

        <ReviewFeedbackAlerts
          errorMessage={errorMessage}
          onDismissError={() => setErrorMessage(null)}
          feedbackSuccess={feedbackSuccess}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <VideoPlayerCard
              review={review}
              videoRef={videoRef}
              currentTimeSec={currentTimeSec}
              accentColor={accentColor}
              isVi={isVi}
              isExpired={isExpired}
              onTimeUpdate={handleTimeUpdate}
              onOpenModal={(type) => setActiveModal(type)}
            />
          </div>

          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <FeedbackTimelineCard
              comments={comments}
              isVi={isVi}
              isExpired={isExpired}
              authorName={authorName}
              setAuthorName={setAuthorName}
              commentText={commentText}
              setCommentText={setCommentText}
              pinTimestamp={pinTimestamp}
              setPinTimestamp={setPinTimestamp}
              currentTimeSec={currentTimeSec}
              isSubmittingComment={isSubmittingComment}
              onSeekTo={seekTo}
              onAddComment={handleAddComment}
            />
          </div>
        </div>
      </main>

      <ReviewDecisionModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        decisionNote={decisionNote}
        setDecisionNote={setDecisionNote}
        isSubmittingDecision={isSubmittingDecision}
        onDecision={handleDecision}
        accentColor={accentColor}
        isVi={isVi}
      />
    </div>
  );
}
