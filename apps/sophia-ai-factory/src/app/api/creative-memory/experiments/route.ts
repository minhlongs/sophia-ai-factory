/**
 * GET  /api/creative-memory/experiments?workspaceId=X — list experiments
 * POST /api/creative-memory/experiments — create new experiment
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess, verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import {
  createExperiment,
  listExperiments,
} from '@/tree/performance/experiment';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ExperimentStatus } from '@/seed/types/creative-domain';
import {
  CreateExperimentSchema,
  GetExperimentsSchema,
  buildExperimentRecord,
} from './experiments-route-helpers';

export const dynamic = 'force-dynamic';

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

  const hasOperator = await verifyWorkspaceRole(parsed.data.workspaceId, user.id, 'OPERATOR');
  if (!hasOperator) {
    return NextResponse.json({ error: 'Forbidden', message: 'Insufficient workspace role' }, { status: 403 });
  }

  try {
    const experiment = buildExperimentRecord(parsed.data);
    await createExperiment(experiment);
    return NextResponse.json({ experiment }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
