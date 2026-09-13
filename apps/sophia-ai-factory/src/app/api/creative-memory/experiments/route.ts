/**
 * GET  /api/creative-memory/experiments?workspaceId=X — list experiments
 * POST /api/creative-memory/experiments — create new experiment
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import {
  createExperiment,
  listExperiments,
  newExperimentId,
} from '@/tree/performance/experiment';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { Experiment, ExperimentStatus, ExperimentVariant } from '@/seed/types/creative-domain';

export const dynamic = 'force-dynamic';

const EXPERIMENT_STATUSES = ['draft', 'running', 'completed', 'cancelled'] as const;

const GetExperimentsSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional(),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
});

const VariantInputSchema = z.object({
  name: z.string().min(1, 'variant name is required'),
  description: z.string().optional().default(''),
  assetId: z.string().optional(),
  trafficPercent: z.number().min(0).max(100),
});

const CreateExperimentSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional().default(''),
  hypothesis: z.string().optional().default(''),
  metric: z.string().optional().default('ctr'),
  audience: z.string().optional().default(''),
  channel: z.string().optional().default(''),
  status: z.enum(EXPERIMENT_STATUSES).optional().default('draft'),
  variants: z.array(VariantInputSchema).optional().default([]),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = {
    workspaceId: searchParams.get('workspaceId') ?? undefined,
    projectId: searchParams.get('projectId') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  };

  const parsed = GetExperimentsSchema.safeParse(rawQuery);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, projectId, status } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const experiments = await listExperiments(workspaceId, {
      projectId: projectId || undefined,
      status: status as ExperimentStatus | undefined,
    });
    return NextResponse.json({ experiments, count: experiments.length });
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

  const parsed = CreateExperimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const { workspaceId, projectId, hypothesis, metric, audience, channel, status, variants } = parsed.data;

  const hasOperator = await verifyWorkspaceRole(workspaceId, user.id, 'OPERATOR');
  if (!hasOperator) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const experimentId = newExperimentId();
    const domainVariants: ExperimentVariant[] = variants.map((v, idx) => ({
      id: `var_${experimentId.slice(4)}_${idx + 1}`,
      experimentId,
      name: v.name,
      description: v.description,
      assetId: v.assetId,
      trafficPercent: v.trafficPercent,
    }));

    const now = Math.floor(Date.now() / 1000);
    const experiment: Experiment = {
      id: experimentId,
      workspaceId,
      projectId,
      hypothesis,
      metric,
      audience,
      channel,
      status: status as ExperimentStatus,
      variants: domainVariants,
      createdAt: now,
      updatedAt: now,
    };

    await createExperiment(experiment);
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
