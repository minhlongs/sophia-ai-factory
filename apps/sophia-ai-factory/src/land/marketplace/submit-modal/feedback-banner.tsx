import React from 'react';
import { CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';
import type { SubmissionFeedback } from './types';

interface SubmissionFeedbackBannerProps {
  feedback: SubmissionFeedback;
}

export function SubmissionFeedbackBanner({ feedback }: SubmissionFeedbackBannerProps) {
  const isApproved = feedback.status === 'approved';
  const isPending = feedback.status === 'pending';

  return (
    <div
      className={`mt-4 rounded-xl border p-4 text-xs ${
        isApproved
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : isPending
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : 'border-red-500/30 bg-red-500/10 text-red-300'
      }`}
    >
      <div className="flex items-center gap-2 font-bold text-sm mb-1">
        {isApproved ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Auto-Approved to Marketplace (Score: {feedback.score}/100)
          </>
        ) : isPending ? (
          <>
            <HelpCircle className="h-4 w-4" />
            Pending Review Queue (Score: {feedback.score}/100)
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4" />
            {feedback.error || `Rejected (Score: ${feedback.score}/100)`}
          </>
        )}
      </div>

      {feedback.feedback.length > 0 && (
        <div className="mt-2 space-y-1">
          <span className="font-semibold">AI Quality Scorer Recommendations:</span>
          <ul className="list-disc pl-4 space-y-0.5 opacity-90">
            {feedback.feedback.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
