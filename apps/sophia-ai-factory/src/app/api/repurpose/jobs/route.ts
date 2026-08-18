/**
 * GET /api/repurpose/jobs
 * List current user's repurpose jobs.
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { listRepurposeJobs } from '@/seed/db/repositories/repurpose-jobs-repo';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobs = await listRepurposeJobs(user.id);
  return NextResponse.json({ jobs });
}