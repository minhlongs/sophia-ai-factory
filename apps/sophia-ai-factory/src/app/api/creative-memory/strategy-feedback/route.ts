/**
 * GET  /api/creative-memory/strategy-feedback?workspaceId=X — fetch strategy feedback recommendations
 * POST /api/creative-memory/strategy-feedback — mark recommendation applied or manually record strategy feedback
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { recordLearning } from '@/tree/creative-memory';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { StrategyRecommendation } from '@/seed/types/performance-feedback';

export const dynamic = 'force-dynamic';

const GetFeedbackSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  applied: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const PostFeedbackSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  recommendationId: z.string().optional(),
  applied: z.boolean().optional(),
  recommendation: z.string().optional(),
  reasoning: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  category: z.string().optional(),
  signalSummary: z.string().optional(),
  signalCount: z.number().int().nonnegative().optional(),
});

interface MemoryRow {
  id: string;
  key: string;
  value: string;
  confidence: string;
  updated_at: number;
  created_at: number;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const parsed = GetFeedbackSchema.safeParse({
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    applied: searchParams.get('applied') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, applied, limit } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    const result = await d1
      .prepare(
        `SELECT id, key, value, confidence, updated_at, created_at
         FROM creative_memory
         WHERE workspace_id = ? AND category = 'performance' AND key LIKE 'strategy:%:recommendation' AND is_deleted = 0
         ORDER BY updated_at DESC LIMIT ?`
      )
      .bind(workspaceId, limit)
      .all<MemoryRow>();

    const recommendations: StrategyRecommendation[] = [];
    for (const row of result.results ?? []) {
      try {
        const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (val && typeof val === 'object') {
          const item = val as StrategyRecommendation;
          if (applied === undefined || item.applied === (applied === 'true')) {
            recommendations.push(item);
          }
        }
      } catch { /* skip corrupted values */ }
    }

    return NextResponse.json({ recommendations, count: recommendations.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const {
    workspaceId, recommendationId, applied, recommendation,
    reasoning, confidence, category, signalSummary, signalCount,
  } = parsed.data;

  if (!(await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR'))) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    const now = Date.now();

    if (recommendationId) {
      const key = `strategy:${recommendationId}:recommendation`;
      const existingRow = await d1
        .prepare(`SELECT id, value FROM creative_memory WHERE workspace_id = ? AND key = ? AND is_deleted = 0`)
        .bind(workspaceId, key)
        .first<{ id: string; value: string }>();

      if (!existingRow) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

      let current: StrategyRecommendation;
      try { current = JSON.parse(existingRow.value) as StrategyRecommendation; } catch {
        return NextResponse.json({ error: 'Corrupted recommendation payload' }, { status: 500 });
      }

      if (applied !== undefined) {
        current.applied = applied;
        current.appliedAt = applied ? now : undefined;
      }
      if (recommendation) current.recommendation = recommendation;
      if (reasoning) current.reasoning = reasoning;
      if (confidence) current.confidence = confidence;

      await d1
        .prepare(`UPDATE creative_memory SET value = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(current), Math.floor(now / 1000), existingRow.id)
        .run();

      return NextResponse.json({ recommendation: current });
    }

    if (!recommendation) {
      return NextResponse.json({ error: 'recommendation is required when creating' }, { status: 400 });
    }

    const recId = `strat_${now}_${workspaceId.slice(0, 8)}`;
    const newRec: StrategyRecommendation = {
      id: recId,
      workspaceId,
      signalCount: signalCount ?? 1,
      signalSummary: signalSummary ?? 'manual_entry',
      recommendation,
      reasoning: reasoning ?? '',
      confidence: confidence ?? 'medium',
      category: category ?? 'general',
      applied: applied ?? false,
      appliedAt: applied ? now : undefined,
      createdAt: now,
    };

    await recordLearning(
      workspaceId,
      'performance',
      `strategy:${recId}:recommendation`,
      newRec,
      JSON.stringify([signalSummary ?? 'manual']),
      'global',
    );

    return NextResponse.json({ recommendation: newRec }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
