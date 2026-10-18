'use client';

import React from 'react';
import { X, Check, ExternalLink } from 'lucide-react';
import type { DrawerFeedback } from './types';

export function DrawerFeedbackAlert({ feedback }: { feedback: DrawerFeedback }) {
  const isSuccess = feedback.type === 'success';
  return (
    <div
      role="alert"
      className={`mt-4 p-4 rounded-xl text-sm border flex items-start gap-2.5 ${
        isSuccess
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/10 text-red-300 border-red-500/30'
      }`}
    >
      {isSuccess ? (
        <Check className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
      ) : (
        <X className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
      )}
      <div className="flex-1">
        <div>{feedback.message}</div>
        {feedback.deepLink && (
          <a
            href={feedback.deepLink}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline mt-2"
          >
            <span>Open Campaign View</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
