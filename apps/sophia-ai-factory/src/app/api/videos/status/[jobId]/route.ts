/**
 * GET /api/videos/status/[jobId]
 *
 * Returns { status, progressPct, error? }
 * Tenant-scoped — returns 403 if job belongs to another tenant.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { getD1Client } from '@/lib/db/client';
import { STATUS_PROGRESS } from '@/lib/video/video-job-fsm';
import type { VideoJobStatus } from '@/lib/video/video-job-fsm';

interface VideoJobStatusRow {
  status: VideoJobStatus;
  tenant_id: string;
  error: string | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const tenantId = user.id;

  const db = await getD1Client();
  const { data, error } = await db
    .from('video_jobs')
    .select('status, tenant_id, error')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const row = data as unknown as VideoJobStatusRow;

  if (row.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    status: row.status,
    progressPct: STATUS_PROGRESS[row.status],
    ...(row.error ? { error: row.error } : {}),
  });
}
