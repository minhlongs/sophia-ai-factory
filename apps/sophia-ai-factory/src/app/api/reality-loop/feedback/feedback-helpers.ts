/**
 * Reality Loop Feedback Helpers
 * Validation schemas and helpers for /api/reality-loop/feedback.
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { logger } from '@/seed/utils/logger-utility';

export const feedbackBodySchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  missionId: z.string().min(1, 'missionId is required'),
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

export type FeedbackInput = z.infer<typeof feedbackBodySchema>;

export async function authenticateAndValidate(request: Request): Promise<{
  user: { id: string };
  data: FeedbackInput;
} | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const validation = feedbackBodySchema.safeParse(rawBody);
  if (!validation.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid feedback payload', details: validation.error.flatten() }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { workspaceId } = validation.data;
  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  return { user: { id: user.id }, data: validation.data };
}

export function createSuccessResponse(stored: { id: string; missionId: string; checkpoint: string; useful: string; reason: string | null; createdAt: string }) {
  return new Response(
    JSON.stringify({
      ok: true,
      feedback: {
        id: stored.id,
        missionId: stored.missionId,
        checkpoint: stored.checkpoint,
        useful: stored.useful,
        reason: stored.reason,
        createdAt: stored.createdAt,
      },
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  );
}

export function createErrorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } });
}

export function logFeedbackSubmission(userId: string, data: FeedbackInput, stored: { reason: string | null; id: string }) {
  logger.info('[RealityFeedback] Submitted', {
    userId,
    workspaceId: data.workspaceId,
    missionId: data.missionId,
    checkpoint: data.checkpoint,
    useful: data.useful,
    reason: stored.reason,
    feedbackId: stored.id,
  });
}