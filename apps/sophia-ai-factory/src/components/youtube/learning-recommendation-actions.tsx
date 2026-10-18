'use client';

// i18n-namespace: youtube

import React from 'react';
import { Check, X } from 'lucide-react';
import type { useTranslations } from 'next-intl';
import { statusLabel, type LearningRecommendation } from './learning-recommendation-helpers';

export interface LearningRecommendationActionsProps {
  status: LearningRecommendation['status'];
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  t: ReturnType<typeof useTranslations>;
}

export function LearningRecommendationActions({
  status,
  busy,
  onApprove,
  onReject,
  t,
}: LearningRecommendationActionsProps) {
  if (status !== 'pending') {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
        {status === 'approved' ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        {statusLabel(status, t)}
      </div>
    );
  }

  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onApprove}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        <Check className="h-4 w-4" />
        {t('approve')}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onReject}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
      >
        <X className="h-4 w-4" />
        {t('reject')}
      </button>
    </div>
  );
}
