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
import { VideoPlayerCard } from './video-player-card';
import { FeedbackTimelineCard } from './feedback-timeline-card';
import { ReviewDecisionModals } from './review-decision-modals';

export function ClientVideoReviewPortal(props: ClientVideoReviewPortalProps) {
  const {
    locale: _locale,
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
  } = useReviewPortalState(props);

  const isApproved = review.status === 'APPROVED';
  const isChangesRequested = review.status === 'CHANGES_REQUESTED';
  const isExpired = review.isExpired;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans pb-16">
      {/* Whitelabel Header */}
      <ReviewPortalHeader
        branding={branding}
        primaryColor={primaryColor}
        isVi={isVi}
        onToggleLocale={() => setLocale(isVi ? 'en' : 'vi')}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Status Notification Banner */}
        <ReviewStatusBanner
          isExpired={isExpired}
          isApproved={isApproved}
          isChangesRequested={isChangesRequested}
          isVi={isVi}
        />

        {/* Action Error/Success Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/60 text-xs text-red-200 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}
        {feedbackSuccess && (
          <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-xs text-emerald-200">
            {feedbackSuccess}
          </div>
        )}

        {/* 2-Column Grid: Left (Player & Details), Right (Feedback & Actions) */}
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

      {/* Decision Modals */}
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
