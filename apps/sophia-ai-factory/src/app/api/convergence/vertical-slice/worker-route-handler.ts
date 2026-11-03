/**
 * HMAC-Authenticated External Mekong Pull-Worker Handler for /api/convergence/vertical-slice (Supreme #02.2 R3)
 * Handles `action: 'claim_next_job'` and `action: 'complete_worker_attempt'` with Web Crypto HMAC-SHA256
 * (`x-mekong-signature`, `x-mekong-timestamp`) and D1 Lease/CAS convergence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import {
  MEKONG_SIGNATURE_HEADER,
  MEKONG_TIMESTAMP_HEADER,
  verifyMekongWorkerHmac,
} from '@/tree/mekong';
import {
  claimNextConvergenceJobD1,
  completeWorkerAttemptD1,
} from '@/forest/convergence/mekong-pull-worker-d1';

const artifactEntrySchema = z.object({
  artifactId: z.string().min(1),
  stageId: z.enum([
    'creative_mission_intake', 'niche_video_plan', 'script_synthesis', 'visual_storyboard',
    'ceo_approval_gate', 'media_render_dispatch', 'media_integrity_verification',
    'channel_delivery_publish', 'delivery_receipt_reconcile', 'budget_credit_accounting',
    'crash_quarantine_recovery', 'converged_terminal',
  ]),
  kind: z.enum(['plan', 'script', 'visual', 'video', 'receipt']),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  uri: z.string().min(1),
  verified: z.boolean(),
  localFilePath: z.string().optional(),
  mimeType: z.string().optional(),
});

const claimSchema = z.object({
  action: z.literal('claim_next_job'),
  workspaceId: z.string().min(1).max(128),
  workerId: z.string().min(1).max(128),
  jobId: z.string().min(1).max(128).optional(),
  leaseToken: z.string().min(1).max(128).optional(),
  leaseDurationMs: z.number().int().min(1000).max(600000).optional(),
});

const completeSchema = z.object({
  action: z.literal('complete_worker_attempt'),
  jobId: z.string().min(1).max(128),
  workspaceId: z.string().min(1).max(128),
  workerId: z.string().min(1).max(128),
  leaseToken: z.string().min(1).max(128),
  expectedVersion: z.number().int().min(1),
  attemptNo: z.number().int().min(1).max(10).optional(),
  executionOutcome: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled', 'crashed']).optional(),
  deliveryOutcome: z.enum(['pending', 'dispatched', 'confirmed', 'failed']).optional(),
  businessOutcome: z.enum(['pending', 'accepted', 'rejected', 'human_review_required']).optional(),
  actualCostUsd: z.number().nonnegative().optional(),
  artifactManifest: z.array(artifactEntrySchema).optional(),
  simulateCorruptMedia: z.boolean().optional(),
});

export const workerPullSchema = z.discriminatedUnion('action', [claimSchema, completeSchema]);

function workerErrorStatus(code: string): number {
  if (code === 'TENANT_MISMATCH') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'LEASE_HELD' || code === 'CAS_VERSION_CONFLICT' || code === 'TERMINAL_STATE_IMMUTABLE' || code === 'RETRY_BUDGET_EXCEEDED') {
    return 409;
  }
  return 422;
}

export function isWorkerPullActionRequest(request: NextRequest, body: unknown): boolean {
  if (request.headers.get(MEKONG_SIGNATURE_HEADER) || request.headers.get(MEKONG_TIMESTAMP_HEADER)) return true;
  if (typeof body === 'object' && body !== null && 'action' in body) {
    const act = (body as { action?: unknown }).action;
    return act === 'claim_next_job' || act === 'complete_worker_attempt';
  }
  return false;
}

export async function handleMekongWorkerPullPost(
  request: NextRequest,
  rawBody: string,
  body: unknown
): Promise<NextResponse> {
  const hmac = await verifyMekongWorkerHmac({
    secret: process.env.MEKONG_WORKER_SHARED_SECRET,
    signatureHeader: request.headers.get(MEKONG_SIGNATURE_HEADER),
    timestampHeader: request.headers.get(MEKONG_TIMESTAMP_HEADER),
    rawBody,
  });
  if (!hmac.ok) {
    return NextResponse.json({ error: hmac.error.message, code: hmac.error.code }, { status: hmac.error.status });
  }
  const parsed = workerPullSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const d1 = await getD1();
  if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (parsed.data.action === 'claim_next_job') {
    const claimed = await claimNextConvergenceJobD1(d1, parsed.data);
    if (!claimed.ok) return NextResponse.json({ error: claimed.error.message, code: claimed.error.code }, { status: workerErrorStatus(claimed.error.code) });
    return NextResponse.json(claimed.value);
  }
  const completed = await completeWorkerAttemptD1(d1, parsed.data);
  if (!completed.ok) return NextResponse.json({ error: completed.error.message, code: completed.error.code }, { status: workerErrorStatus(completed.error.code) });
  return NextResponse.json(completed.value);
}
