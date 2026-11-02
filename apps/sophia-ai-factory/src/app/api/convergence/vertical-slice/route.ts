/**
 * POST /api/convergence/vertical-slice — execute 12-stage Creative Job vertical slice with D1 persistence
 * GET  /api/convergence/vertical-slice?workspaceId=X&jobId=Y — read converged job truth state & unit economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  ConvergenceLedgerRepo, calculateUnitEconomics, createOrGetConvergenceJobD1,
  evaluateConvergedTruth, getConvergenceJobByIdD1, listConvergenceJobsByWorkspaceD1, upsertConvergenceRecordD1,
} from '@/tree/convergence';
import { runCreativeJobVerticalSlice } from '@/forest/convergence/creative-job-pipeline';

export const dynamic = 'force-dynamic';

const runSliceSchema = z.object({
  jobId: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(128),
  goal: z.string().min(1).max(2000),
  contractMode: z.enum(['DISABLED', 'SHADOW', 'LOCAL_TEST', 'ENABLED']).optional(),
  ceoDecision: z.enum(['approve', 'reject', 'hold']).optional(),
  simulateCorruptMedia: z.boolean().optional(),
  simulateDeliveryFailure: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = runSliceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }

  const { workspaceId, jobId, idempotencyKey, goal, contractMode, ceoDecision, simulateCorruptMedia, simulateDeliveryFailure } = parsed.data;
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = await getD1();
    if (d1) {
      const precheck = await createOrGetConvergenceJobD1(d1, { jobId, workspaceId, userId: user.id, idempotencyKey, estimatedCostUsd: 0.77 });
      if (!precheck.ok) {
        return NextResponse.json({ error: precheck.error.message, code: precheck.error.code }, { status: precheck.error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400 });
      }
      if (precheck.value.deduplicated && precheck.value.record.lifecycleStage !== 'creative_mission_intake') {
        const existingJobs = await listConvergenceJobsByWorkspaceD1(d1, workspaceId);
        const rec = precheck.value.record;
        return NextResponse.json({
          record: rec,
          truthState: evaluateConvergedTruth(rec, rec.sideEffectUncertain, rec.verificationReport.hasVerifiedMedia),
          unitEconomics: calculateUnitEconomics(existingJobs),
          mekongTicketId: rec.mekongJobId,
          deduplicated: true,
        });
      }
    }

    const repo = new ConvergenceLedgerRepo();
    const res = runCreativeJobVerticalSlice(repo, {
      jobId, workspaceId, userId: user.id, idempotencyKey, goal, contractMode, ceoDecision, simulateCorruptMedia, simulateDeliveryFailure,
    });
    if (!res.ok) return NextResponse.json({ error: res.error.message, code: res.error.code }, { status: 422 });

    if (d1) {
      const persisted = await upsertConvergenceRecordD1(d1, res.value.record);
      if (!persisted.ok) return NextResponse.json({ error: persisted.error.message, code: persisted.error.code }, { status: 409 });
      const allWorkspaceRecords = await listConvergenceJobsByWorkspaceD1(d1, workspaceId);
      return NextResponse.json({ ...res.value, record: persisted.value, unitEconomics: calculateUnitEconomics(allWorkspaceRecords) });
    }
    return NextResponse.json(res.value);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const workspaceId = sp.get('workspaceId');
  const jobId = sp.get('jobId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const d1 = await getD1();
    if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const records = await listConvergenceJobsByWorkspaceD1(d1, workspaceId);
    const unitEconomics = calculateUnitEconomics(records);
    if (jobId) {
      const single = await getConvergenceJobByIdD1(d1, jobId, workspaceId);
      if (!single.ok) {
        return NextResponse.json({ error: single.error.message, code: single.error.code }, { status: single.error.code === 'TENANT_MISMATCH' ? 403 : 404 });
      }
      return NextResponse.json({
        record: single.value,
        truthState: evaluateConvergedTruth(single.value, single.value.sideEffectUncertain, single.value.verificationReport.hasVerifiedMedia),
        unitEconomics,
      });
    }
    return NextResponse.json({ records, unitEconomics });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
