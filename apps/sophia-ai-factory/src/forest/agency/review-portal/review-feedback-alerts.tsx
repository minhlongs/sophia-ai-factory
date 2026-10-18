'use client';

import React from 'react';

interface ReviewFeedbackAlertsProps {
  errorMessage: string | null;
  onDismissError: () => void;
  feedbackSuccess: string | null;
}

export function ReviewFeedbackAlerts({
  errorMessage,
  onDismissError,
  feedbackSuccess,
}: ReviewFeedbackAlertsProps) {
  if (!errorMessage && !feedbackSuccess) return null;

  return (
    <>
      {errorMessage && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/60 text-xs text-red-200 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={onDismissError}
            className="text-red-400 hover:text-white font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}
      {feedbackSuccess && (
        <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-xs text-emerald-200">
          {feedbackSuccess}
        </div>
      )}
    </>
  );
}
