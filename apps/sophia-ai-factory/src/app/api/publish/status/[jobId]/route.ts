/**
 * GET /api/publish/status/[jobId]
 *
 * Returns publishing job row + result (if available).
 * Auth: Bearer (OpenClaw plugin, scope: publish:read) OR session cookie
 */

import { NextResponse } from 'next/server';
import { getCurrentUserOrOpenClaw, isAuthError } from '@/seed/auth/get-current-user-or-openclaw';
import { getD1Client } from '@/seed/db/client';
import type { PublishingJob, PublishingResult } from '@/lib/publishing/publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  try {
    const auth = await getCurrentUserOrOpenClaw(request, { requiredScope: 'publish:read' });
    if (isAuthError(auth)) return auth.toNextResponse();

    const { jobId } = await params;
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
    }

    const tenantId = auth.userId;
    const db = await getD1Client();

    const { data: jobData } = await db
      .from('publishing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    const job = jobData as PublishingJob | null;
    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (job.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch result if any
    const { data: resultData } = await db
      .from('publishing_results')
      .select('*')
      .eq('publishing_job_id', jobId)
      .maybeSingle();

    const result = resultData as PublishingResult | null;

    return NextResponse.json({ job, result: result ?? null });
  } catch (err) {
    logger.error('[publish/status] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
