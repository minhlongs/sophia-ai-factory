/**
 * Learnings list — client wrapper around LearningRecommendationCard.
 * Calls approveRecommendationAction / rejectRecommendationAction server actions.
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LearningRecommendationCard } from '@/components/youtube/learning-recommendation-card';
import { approveRecommendationAction, rejectRecommendationAction } from './actions';
import type { RecommendationRow } from './data';

function rowToRecommendation(row: RecommendationRow) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    rationale: row.rationale ?? '',
    evidence: row.evidence ? parseJson(row.evidence, {}) : {},
    proposedChange: row.proposedChange ? parseJson(row.proposedChange, {}) : {},
    confidence: (row.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    status: row.status,
    createdAt: row.createdAt,
  };
}

function parseJson(raw: string, fallback: Record<string, unknown>): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function LearningsList({
  recommendations,
}: {
  recommendations: readonly RecommendationRow[];
}) {
  const t = useTranslations('youtube');

  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('noRecommendations')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((row) => (
        <LearningRecommendationCard
          key={row.id}
          recommendation={rowToRecommendation(row)}
          onApprove={async (id) => {
            const result = await approveRecommendationAction({ recommendationId: id });
            if (!result.ok) throw new Error(result.error.message);
          }}
          onReject={async (id) => {
            const result = await rejectRecommendationAction({ recommendationId: id });
            if (!result.ok) throw new Error(result.error.message);
          }}
        />
      ))}
    </div>
  );
}