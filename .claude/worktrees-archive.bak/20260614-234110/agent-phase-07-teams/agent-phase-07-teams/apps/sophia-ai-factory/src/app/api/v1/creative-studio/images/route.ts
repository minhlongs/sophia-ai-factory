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

interface MediaJobRow {
  id: string;
  type: string;
  model: string;
  prompt: string | null;
  status: string;
  result_url: string | null;
  thumbnail_url: string | null;
  created_at: number;
  completed_at: number | null;
}

export async function GET(): Promise<NextResponse> {
  // Auth check
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createServerClient();
    const { data: rows, error } = await db
      .from('media_jobs')
      .select('id, type, model, prompt, status, result_url, thumbnail_url, created_at, completed_at')
      .eq('user_id', user.id)
      .eq('type', 'image')
      .order('created_at', { ascending: false })
      .limit(50) as { data: MediaJobRow[] | null; error: { message: string } | null };

    if (error) {
      logger.error('[creative-studio/images] D1 query failed', new Error(error.message));
      return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ images: rows ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[creative-studio/images] Unexpected error', new Error(message));
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
