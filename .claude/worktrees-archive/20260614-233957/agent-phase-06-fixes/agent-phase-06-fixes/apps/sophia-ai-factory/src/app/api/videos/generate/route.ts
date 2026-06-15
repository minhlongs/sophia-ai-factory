/**
 * POST /api/videos/generate — DEPRECATED 2026-05-17 (ADR 0007).
 *
 * The `video_jobs` table this endpoint wrote to was never applied to prod D1,
 * so the legacy Phase 06 Inngest chain has been silent-failing since inception.
 * The canonical video generation path is now the HeyGen mission flow
 * (`video:create` mission → HeyGen webhook → `videos` table).
 *
 * Returns HTTP 410 Gone with redirect hint. Auth check preserved so unauthenticated
 * probes still get 401, not 410 (security through obscurity for unauth fingerprinting).
 */

import { NextResponse } from 'next/server';
import { getCurrentUserOrOpenClaw, isAuthError } from '@/seed/auth/get-current-user-or-openclaw';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await getCurrentUserOrOpenClaw(request, { requiredScope: 'video:write' });
  if (isAuthError(auth)) return auth.toNextResponse();

  return NextResponse.json(
    {
      error: 'Endpoint deprecated.',
      message: 'Video generation has moved to the HeyGen mission flow. Use the `video:create` mission instead.',
      replacement: '/api/missions',
      adr: 'ADR-0007',
    },
    { status: 410 },
  );
}
