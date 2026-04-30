/**
 * GET /api/publish/status/[jobId]
 *
 * Returns publishing job row + result (if available).
 * Auth: session cookie
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { getD1Client } from '@/lib/db/client';
import type { PublishingJob, PublishingResult } from '@/lib/publishing/publisher-interface';
import { logger } from '@/lib/utils/logger-utility';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Invalid jobId' }, { status: 400 });
    }

    const tenantId = user.id;
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
      .eq('job_id', jobId)
      .maybeSingle();

    const result = resultData as PublishingResult | null;

    return NextResponse.json({ job, result: result ?? null });
  } catch (err) {
    logger.error('[publish/status] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
