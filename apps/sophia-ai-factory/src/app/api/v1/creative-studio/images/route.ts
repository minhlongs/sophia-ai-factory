/**
 * GET /api/v1/creative-studio/images
 *
 * Returns the authenticated user's image generation history (last 50 jobs).
 * Auth required — returns 401 if unauthenticated.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { handleThrownError } from '@/seed/api';
import { listUserImageJobs } from '@/tree/creative-studio/image-job-queries';

export async function GET(): Promise<NextResponse> {
  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await listUserImageJobs(createServerClient(), user.id);
    return NextResponse.json({ images: rows });
  } catch (err) {
    return handleThrownError(err, 'Internal server error', 'IMAGE_LIST_FAILED');
  }
}
