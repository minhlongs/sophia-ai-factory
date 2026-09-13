/**
 * GET  /api/creative-intelligence/hook-dna?workspaceId=X — fetch winning hook DNA & patterns
 * POST /api/creative-intelligence/hook-dna — record or update hook DNA pattern
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { PlaybookPatternRow } from '@/seed/types/playbook-pattern';

export const dynamic = 'force-dynamic';

const GetHookDnaSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  hookType: z.string().optional(),
  metric: z.string().optional(),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const PostHookDnaSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  hookType: z.string().min(1, 'hookType is required'),
  metric: z.string().optional().default('ctr'),
  avgMetric: z.number().min(0),
  sampleSize: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  confidenceLevel: z.enum(['high', 'medium', 'low']).optional(),
  source: z.enum(['experiment', 'memory', 'roi']).optional().default('experiment'),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    hookType: searchParams.get('hookType') ?? undefined,
    metric: searchParams.get('metric') ?? undefined,
    confidenceLevel: searchParams.get('confidenceLevel') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };

  const parsed = GetHookDnaSchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, hookType, metric, confidenceLevel, limit } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    let sql = `SELECT * FROM playbook_patterns WHERE workspace_id = ? AND feature_key = 'hook_type'`;
    const params: (string | number)[] = [workspaceId];

    if (hookType) {
      sql += ' AND feature_value = ?';
      params.push(hookType);
    }
    if (metric) {
      sql += ' AND metric = ?';
      params.push(metric);
    }
    if (confidenceLevel) {
      sql += ' AND confidence_level = ?';
      params.push(confidenceLevel);
    }

    sql += ' ORDER BY confidence DESC, avg_metric DESC LIMIT ?';
    params.push(limit);

    const result = await d1.prepare(sql).bind(...params).all<PlaybookPatternRow>();
    const patterns = (result.results ?? []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      hookType: row.feature_value,
      metric: row.metric,
      avgMetric: row.avg_metric,
      sampleSize: row.sample_size,
      confidence: row.confidence,
      confidenceLevel: row.confidence_level,
      source: row.source,
      detectedAt: row.detected_at,
    }));

    return NextResponse.json({ patterns, count: patterns.length });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostHookDnaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const {
    workspaceId,
    hookType,
    metric,
    avgMetric,
    sampleSize,
    confidence,
    confidenceLevel,
    source,
  } = parsed.data;

  const hasOperator = await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR');
  if (!hasOperator) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const d1 = createServerClient();
    const now = Date.now();
    const id = `pat_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const level = confidenceLevel ?? (confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low');

    await d1
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value,
          metric, avg_metric, sample_size, confidence,
          confidence_level, source, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        workspaceId,
        'hook_type',
        hookType,
        metric,
        avgMetric,
        sampleSize,
        confidence,
        level,
        source,
        now,
        now
      )
      .run();

    return NextResponse.json(
      {
        id,
        workspaceId,
        hookType,
        metric,
        avgMetric,
        sampleSize,
        confidence,
        confidenceLevel: level,
        source,
        detectedAt: now,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
