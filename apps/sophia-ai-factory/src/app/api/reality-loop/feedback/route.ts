/**
 * POST /api/reality-loop/feedback
 *
 * Submit structured human feedback at a reality-loop checkpoint.
 *
 * Checkpoints (Zod enum):
 *   mission_complete    — mission finished end-to-end
 *   creative_rejected   — human rejected a creative output
 *   human_correction    — human made a significant correction
 *   mission_abandoned   — mission was abandoned mid-flight
 *
 * Questions: Was this useful? YES/NO. If NO → reason enum + optional free text.
 *
 * Auth: any authenticated user member of `workspaceId`.
 * Idempotent: re-submitting the same (mission, checkpoint, day) is a no-op.
 * Privacy: free_text stored but NEVER logged raw. No prompts/secrets/PII.
 *
 * Edge runtime compatible (Cloudflare Workers).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { saveFeedback, type FeedbackInput } from '@/land/reality-loop/feedback-store';
import { logger } from '@/seed/utils/logger-utility';

// ── Validation ───────────────────────────────────────────────────────────────

const feedbackBodySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  missionId:   z.string().min(1, 'missionId is required'),
  checkpoint: z.enum([
    'mission_complete',
    'creative_rejected',
    'human_correction',
    'mission_abandoned',
  ], { message: 'checkpoint must be one of: mission_complete, creative_rejected, human_correction, mission_abandoned' }),
  useful: z.enum(['YES', 'NO'], { message: 'useful must be YES or NO' }),
  reason: z.enum([
    'WRONG',
    'LOW_QUALITY',
    'NOT_MY_STYLE',
    'TOO_EXPENSIVE',
    'TOO_SLOW',
    'TOO_COMPLEX',
    'NOT_USEFUL',
    'OTHER',
  ]).optional().nullable(),
  freeText: z.string().max(2000, 'freeText must be <= 2000 chars').optional().nullable(),
});

// ── Auth scope ───────────────────────────────────────────────────────────────

async function verifyWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse + validate body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = feedbackBodySchema.safeParse(rawBody);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid feedback payload', details: validation.error.flatten() },
      { status: 400 },
    );
  }

  const { workspaceId, missionId, checkpoint, useful, reason, freeText } = validation.data;

  // Workspace access check
  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Persist (idempotent). Log only metadata — NEVER free_text.
  const input: FeedbackInput = {
    workspaceId,
    missionId,
    checkpoint,
    useful,
    reason: reason ?? null,
    freeText: freeText ?? null,
  };

  try {
    const stored = await saveFeedback(input);

    logger.info('[RealityFeedback] Submitted', {
      userId: user.id,
      workspaceId,
      missionId,
      checkpoint,
      useful,
      reason: stored.reason,
      feedbackId: stored.id,
    });

    return NextResponse.json(
      {
        ok: true,
        feedback: {
          id: stored.id,
          missionId: stored.missionId,
          checkpoint: stored.checkpoint,
          useful: stored.useful,
          reason: stored.reason,
          createdAt: stored.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      '[RealityFeedback] Persist failed',
      error instanceof Error ? error : new Error(String(error)),
      { workspaceId, missionId, checkpoint },
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}