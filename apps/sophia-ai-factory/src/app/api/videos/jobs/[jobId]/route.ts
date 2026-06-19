/**
 * GET /api/videos/jobs/[jobId]
 *
 * Returns full video_jobs row + R2 URL when status=published.
 * Tenant-scoped — returns 403 for cross-tenant access.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import type { VideoJobStatus } from '@/land/video/generation/video-job-fsm';

interface VideoJobRow {
  id: string;
  tenant_id: string;
  user_id: string;
  status: VideoJobStatus;
  prompt: string;
  tier: string;
  script_text: string | null;
  audio_r2_key: string | null;
  visual_r2_key: string | null;
  final_r2_key: string | null;
  error: string | null;
  cost_usd: number;
  created_at: number;
  updated_at: number;
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

  const db = createServerClient();
  const { data, error } = await db
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const row = data as unknown as VideoJobRow;

  if (row.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let videoUrl: string | null = null;

  if (row.status === 'published' && row.final_r2_key) {
    const r2 = await getVideoBucket();
    if (r2?.publicBaseUrl) {
      videoUrl = `${r2.publicBaseUrl}/${row.final_r2_key}`;
    }
  }

  return NextResponse.json({
    ...row,
    video_url: videoUrl,
  });
}
