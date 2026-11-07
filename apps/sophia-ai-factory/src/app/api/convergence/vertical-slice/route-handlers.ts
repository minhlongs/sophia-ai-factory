/**
 * Route Action & Query Helpers for /api/convergence/vertical-slice (Supreme #02.1 P1, P2, P3)
 *
 * Enforces workspace tenant isolation across job create/run, status read,
 * artifact retrieval (`T12`), cancel (`T13`), and approval (`T19`).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { D1Database } from '@/seed/db/client';
import {
  calculateUnitEconomics, cancelConvergenceJobD1,
  decideConvergenceApprovalD1, evaluateConvergedTruth, getConvergenceArtifactByIdD1,
  getConvergenceJobByIdD1, listConvergenceJobsByWorkspaceD1,
} from '@/tree/convergence';
import { runCreativeJobVerticalSliceD1 } from '@/forest/convergence/creative-job-d1-runner';

export const runSliceSchema = z.object({
  action: z.enum(['run', 'cancel', 'decide_approval']).optional(),
  jobId: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(128).optional(),
  goal: z.string().min(1).max(2000).optional(),
  // Only the non-claiming modes are accepted over HTTP. `LOCAL_TEST` and
  // `ENABLED` label the run as executed/verified, but this endpoint binds no
  // Mekong runtime and no artifact root, so the artifacts it produces are
  // synthesized rather than rendered. Accepting those modes would let a caller
  // manufacture a VERIFIED_SUCCESS result with no media behind it.
  contractMode: z.enum(['DISABLED', 'SHADOW']).optional(),
  ceoDecision: z.enum(['approve', 'reject', 'hold']).optional(),
  costStatus: z.enum(['measured', 'estimated', 'unknown']).optional(),
  retryBudget: z.number().int().min(1).max(10).optional(),
  simulateCorruptMedia: z.boolean().optional(),
  simulateDeliveryFailure: z.boolean().optional(),
});

export type RunSlicePayload = z.infer<typeof runSliceSchema>;

function statusFromErrorCode(code: string): number {
  if (code === 'TENANT_MISMATCH') return 403;
  if (code === 'NOT_FOUND' || code === 'ARTIFACT_NOT_FOUND') return 404;
  if (code === 'IDEMPOTENCY_CONFLICT' || code === 'CAS_CONFLICT' || code === 'LEASE_HELD' || code === 'TERMINAL_STATE_IMMUTABLE' || code === 'RETRY_BUDGET_EXCEEDED') return 409;
  return 422;
}

export async function handleConvergencePostAction(
  d1: D1Database | null, userId: string, data: RunSlicePayload
): Promise<NextResponse> {
  const action = data.action ?? 'run';
  if (action === 'cancel') {
    if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const c = await cancelConvergenceJobD1(d1, data.jobId, data.workspaceId);
    if (!c.ok) return NextResponse.json({ error: c.error.message, code: c.error.code }, { status: statusFromErrorCode(c.error.code) });
    return NextResponse.json({
      record: c.value,
      truthState: evaluateConvergedTruth(c.value, c.value.sideEffectUncertain, c.value.verificationReport.hasVerifiedMedia),
    });
  }
  if (action === 'decide_approval') {
    if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    const dec = await decideConvergenceApprovalD1(d1, data.jobId, data.workspaceId, data.ceoDecision ?? 'approve');
    if (!dec.ok) return NextResponse.json({ error: dec.error.message, code: dec.error.code }, { status: statusFromErrorCode(dec.error.code) });
    return NextResponse.json({
      record: dec.value,
      truthState: evaluateConvergedTruth(dec.value, dec.value.sideEffectUncertain, dec.value.verificationReport.hasVerifiedMedia),
    });
  }

  const idempotencyKey = data.idempotencyKey ?? `idem_${data.jobId}`;
  const goal = data.goal ?? 'Generate bilingual creative campaign video';
  // A run without durable storage has no idempotency, no lease, and nowhere to
  // record the result, so a success response would describe a job that never
  // existed. Fail closed like the cancel and approval branches above.
  if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const resD1 = await runCreativeJobVerticalSliceD1(d1, {
    jobId: data.jobId, workspaceId: data.workspaceId, userId, idempotencyKey, goal,
    contractMode: data.contractMode, ceoDecision: data.ceoDecision, costStatus: data.costStatus,
    retryBudget: data.retryBudget, simulateCorruptMedia: data.simulateCorruptMedia, simulateDeliveryFailure: data.simulateDeliveryFailure,
  });
  if (!resD1.ok) return NextResponse.json({ error: resD1.error.message, code: resD1.error.code }, { status: statusFromErrorCode(resD1.error.code) });
  return NextResponse.json(resD1.value);
}

export async function handleConvergenceGetQuery(
  d1: D1Database, workspaceId: string, jobId: string | null, artifactId: string | null
): Promise<NextResponse> {
  if (jobId && artifactId) {
    const art = await getConvergenceArtifactByIdD1(d1, jobId, workspaceId, artifactId);
    if (!art.ok) return NextResponse.json({ error: art.error.message, code: art.error.code }, { status: statusFromErrorCode(art.error.code) });
    return NextResponse.json({ artifact: art.value });
  }
  const records = await listConvergenceJobsByWorkspaceD1(d1, workspaceId);
  const unitEconomics = calculateUnitEconomics(records);
  if (jobId) {
    const single = await getConvergenceJobByIdD1(d1, jobId, workspaceId);
    if (!single.ok) return NextResponse.json({ error: single.error.message, code: single.error.code }, { status: statusFromErrorCode(single.error.code) });
    return NextResponse.json({
      record: single.value,
      truthState: evaluateConvergedTruth(single.value, single.value.sideEffectUncertain, single.value.verificationReport.hasVerifiedMedia),
      unitEconomics,
    });
  }
  return NextResponse.json({ records, unitEconomics });
}
