/**
 * POST /api/convergence/vertical-slice — execute 12-stage Creative Job vertical slice, cancel/approval action,
 * or HMAC-authenticated External Mekong Pull-Worker (`claim_next_job` / `complete_worker_attempt`) with D1 Lease/CAS persistence
 * GET  /api/convergence/vertical-slice?workspaceId=X&jobId=Y&artifactId=Z — read converged job truth state, artifact, & unit economics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  handleConvergenceGetQuery,
  handleConvergencePostAction,
  runSliceSchema,
} from './route-handlers';
import {
  handleMekongWorkerPullPost,
  isWorkerPullActionRequest,
} from './worker-route-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let rawBody = '';
  let body: unknown;
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (isWorkerPullActionRequest(request, body)) {
    try {
      return await handleMekongWorkerPullPost(request, rawBody, body);
    } catch (err) {
      return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
    }
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = runSliceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  if (!(await verifyWorkspaceAccess(parsed.data.workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = await getD1();
    return await handleConvergencePostAction(d1, user.id, parsed.data);
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
  const artifactId = sp.get('artifactId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
  if (!(await verifyWorkspaceAccess(workspaceId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const d1 = await getD1();
    if (!d1) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    return await handleConvergenceGetQuery(d1, workspaceId, jobId, artifactId);
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
