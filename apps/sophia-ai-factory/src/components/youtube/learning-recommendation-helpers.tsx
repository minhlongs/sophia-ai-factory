// i18n-namespace: youtube
'use client';

import React from 'react';
import { BookOpen, TrendingUp } from 'lucide-react';
import type { useTranslations } from 'next-intl';

export interface LearningRecommendation {
  id: string;
  category: string;
  title: string;
  rationale: string;
  evidence: Record<string, unknown>;
  proposedChange: Record<string, unknown>;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export function confidenceClass(confidence: LearningRecommendation['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export function statusLabel(
  status: LearningRecommendation['status'],
  t: ReturnType<typeof useTranslations>,
): string {
  if (status === 'approved') return t('approved');
  if (status === 'rejected') return t('rejected');
  return t('pending');
}

export function LearningRecommendationPayloads({
  recommendation,
  t,
}: {
  recommendation: LearningRecommendation;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {recommendation.evidence && Object.keys(recommendation.evidence).length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            {t('evidence')}
          </div>
          <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground">
            {JSON.stringify(recommendation.evidence, null, 2)}
          </pre>
        </div>
      )}

      {recommendation.proposedChange && Object.keys(recommendation.proposedChange).length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <TrendingUp className="h-3.5 w-3.5" />
            {t('proposedChange')}
          </div>
          <pre className="mt-1 overflow-x-auto text-[11px] text-amber-800">
            {JSON.stringify(recommendation.proposedChange, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
