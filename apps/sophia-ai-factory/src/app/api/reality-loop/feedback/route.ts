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
import { saveFeedback, type FeedbackStored } from '@/land/reality-loop/feedback-store';
import {
  authenticateAndValidate,
  createSuccessResponse,
  createErrorResponse,
  logFeedbackSubmission,
} from './feedback-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await authenticateAndValidate(request);
  if (authResult instanceof Response) {
    return NextResponse.json(
      JSON.parse(await authResult.text()),
      { status: authResult.status, headers: authResult.headers }
    );
  }

  const { user, data } = authResult;
  const { workspaceId, missionId, checkpoint, useful, reason, freeText } = data;

  const input = {
    workspaceId,
    missionId,
    checkpoint,
    useful,
    reason: reason ?? null,
    freeText: freeText ?? null,
  };

  try {
    const stored = await saveFeedback(input) as FeedbackStored;
    logFeedbackSubmission(user.id, data, stored);
    const successResponse = createSuccessResponse({
      id: stored.id,
      missionId: stored.missionId,
      checkpoint: stored.checkpoint,
      useful: stored.useful,
      reason: stored.reason,
      createdAt: String(stored.createdAt),
    });
    return NextResponse.json(
      JSON.parse(await successResponse.text()),
      { status: successResponse.status, headers: successResponse.headers }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}