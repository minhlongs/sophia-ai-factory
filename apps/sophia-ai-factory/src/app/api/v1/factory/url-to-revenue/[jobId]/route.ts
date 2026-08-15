/**
 * GET /api/v1/factory/url-to-revenue/[jobId]
 *
 * Get status of a URL-to-revenue job.
 * Auth: getCurrentUser() — tenant isolation enforced.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getJobStatus } from '@/land/factory/url-to-revenue';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { handleThrownError } from '@/seed/api';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;
  return withRateLimit(async (_r: NextRequest) => {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    try {
      const result = await getJobStatus(user.id, jobId);
      return NextResponse.json(result);
    } catch (err) {
      return handleThrownError(err, 'Failed to fetch job status', 'JOB_STATUS_FAILED');
    }
  }, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 60 } })(_request);
}
