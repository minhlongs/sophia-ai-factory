/**
 * Schemas and D1 query/mutation helpers for /api/creative-memory/strategy-feedback.
 * @module app/api/creative-memory/strategy-feedback/strategy-feedback-helpers
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { recordLearning } from '@/tree/creative-memory';
import type { StrategyRecommendation } from '@/seed/types/performance-feedback';
import {
  GetFeedbackSchema,
  PostFeedbackSchema,
  type PostFeedbackInput,
} from './strategy-feedback-schemas';

export { GetFeedbackSchema, PostFeedbackSchema };

interface MemoryRow {
  id: string;
  key: string;
  value: string;
  confidence: string;
  updated_at: number;
  created_at: number;
}

function parseRecommendationRow(
  row: MemoryRow,
  appliedFilter: 'true' | 'false' | undefined,
): StrategyRecommendation | null {
  try {
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    if (!val || typeof val !== 'object') return null;
    const item = val as StrategyRecommendation;
    if (appliedFilter !== undefined && item.applied !== (appliedFilter === 'true')) {
      return null;
    }
    return item;
  } catch {
    return null;
  }
}

export async function queryStrategyFeedback(
  workspaceId: string,
  applied: 'true' | 'false' | undefined,
  limit: number,
): Promise<StrategyRecommendation[]> {
  const d1 = createServerClient();
  const result = await d1
    .prepare(
      `SELECT id, key, value, confidence, updated_at, created_at
       FROM creative_memory
       WHERE workspace_id = ? AND category = 'performance' AND key LIKE 'strategy:%:recommendation' AND is_deleted = 0
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .bind(workspaceId, limit)
    .all<MemoryRow>();

  const recommendations: StrategyRecommendation[] = [];
  for (const row of result.results ?? []) {
    const item = parseRecommendationRow(row, applied);
    if (item) recommendations.push(item);
  }
  return recommendations;
}

async function updateExistingRecommendation(
  data: PostFeedbackInput,
  recommendationId: string,
  now: number,
): Promise<NextResponse> {
  const d1 = createServerClient();
  const key = `strategy:${recommendationId}:recommendation`;
  const existingRow = await d1
    .prepare(`SELECT id, value FROM creative_memory WHERE workspace_id = ? AND key = ? AND is_deleted = 0`)
    .bind(data.workspaceId, key)
    .first<{ id: string; value: string }>();

  if (!existingRow) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  let current: StrategyRecommendation;
  try {
    current = JSON.parse(existingRow.value) as StrategyRecommendation;
  } catch {
    return NextResponse.json({ error: 'Corrupted recommendation payload' }, { status: 500 });
  }

  if (data.applied !== undefined) {
    current.applied = data.applied;
    current.appliedAt = data.applied ? now : undefined;
  }
  if (data.recommendation) current.recommendation = data.recommendation;
  if (data.reasoning) current.reasoning = data.reasoning;
  if (data.confidence) current.confidence = data.confidence;

  await d1
    .prepare(`UPDATE creative_memory SET value = ?, updated_at = ? WHERE id = ?`)
    .bind(JSON.stringify(current), Math.floor(now / 1000), existingRow.id)
    .run();

  return NextResponse.json({ recommendation: current });
}

export async function upsertStrategyFeedback(
  data: PostFeedbackInput,
): Promise<NextResponse> {
  const now = Date.now();
  if (data.recommendationId) {
    return updateExistingRecommendation(data, data.recommendationId, now);
  }
  if (!data.recommendation) {
    return NextResponse.json({ error: 'recommendation is required when creating' }, { status: 400 });
  }

  const recId = `strat_${now}_${data.workspaceId.slice(0, 8)}`;
  const newRec: StrategyRecommendation = {
    id: recId, workspaceId: data.workspaceId, signalCount: data.signalCount ?? 1,
    signalSummary: data.signalSummary ?? 'manual_entry', recommendation: data.recommendation,
    reasoning: data.reasoning ?? '', confidence: data.confidence ?? 'medium',
    category: data.category ?? 'general', applied: data.applied ?? false,
    appliedAt: data.applied ? now : undefined, createdAt: now,
  };

  await recordLearning(
    data.workspaceId, 'performance', `strategy:${recId}:recommendation`,
    newRec, JSON.stringify([data.signalSummary ?? 'manual']), 'global',
  );

  return NextResponse.json({ recommendation: newRec }, { status: 201 });
}
