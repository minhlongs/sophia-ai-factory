/**
 * Learning recommendation card — approve/reject UI for evidence-backed
 * recommendations produced by the learning engine.
 */

'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X, AlertTriangle } from 'lucide-react';
import {
  confidenceClass,
  statusLabel,
  LearningRecommendationPayloads,
  type LearningRecommendation,
} from './learning-recommendation-helpers';

export type { LearningRecommendation };

interface LearningRecommendationCardProps {
  recommendation: LearningRecommendation;
  onApprove?: (id: string) => Promise<void> | void;
  onReject?: (id: string) => Promise<void> | void;
}

export function LearningRecommendationCard({
  recommendation,
  onApprove,
  onReject,
}: LearningRecommendationCardProps) {
  const t = useTranslations('youtube');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onApprove?.(recommendation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('approveError'));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    setError(null);
    try {
      await onReject?.(recommendation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rejectError'));
    } finally {
      setBusy(false);
    }
  };

  const isDecided = recommendation.status !== 'pending';

  return (
    <div
      className={`rounded-lg border bg-background p-4 transition ${
        isDecided ? 'border-border opacity-75' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {recommendation.category}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceClass(
                recommendation.confidence,
              )}`}
            >
              {t('confidence')}: {recommendation.confidence}
            </span>
            {isDecided && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {statusLabel(recommendation.status, t)}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-foreground">
            {recommendation.title}
          </h3>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {recommendation.rationale}
      </p>

      <LearningRecommendationPayloads recommendation={recommendation} t={t} />

      {error && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {isDecided ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
          {recommendation.status === 'approved' ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          {statusLabel(recommendation.status, t)}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {t('approve')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            {t('reject')}
          </button>
        </div>
      )}
    </div>
  );
}
