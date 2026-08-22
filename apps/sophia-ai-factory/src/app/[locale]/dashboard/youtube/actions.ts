/**
 * Server Actions for the YouTube content pipeline dashboard.
 * approveRecommendation / rejectRecommendation — update learning recommendation status.
 * Auth via getCurrentUser(); DB via getD1() (async, ownership-checked).
 * @module app/[locale]/dashboard/youtube/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import { getD1 } from '@/seed/db/client';

const RecommendationIdSchema = z.object({
  recommendationId: z.string().min(1, 'recommendationId is required'),
});

export type UpdateRecommendationActionInput = z.infer<typeof RecommendationIdSchema>;

export type UpdateRecommendationActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'DB_ERROR'; message: string };

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

async function updateRecommendationStatus(
  recommendationId: string,
  userId: string,
  status: 'approved' | 'rejected',
): Promise<Result<{ id: string; status: string }, UpdateRecommendationActionError>> {
  const parsed = RecommendationIdSchema.safeParse({ recommendationId });
  if (!parsed.success) {
    return failure({ code: 'VALIDATION_ERROR', message: formatZodError(parsed.error) });
  }

  const db = await getD1();
  if (!db) return failure({ code: 'DB_ERROR', message: 'Database not available' });

  const now = new Date().toISOString();
  const res = await db
    .prepare(
      `UPDATE youtube_learning_recommendations
       SET status = ?1, approved_at = ?2
       WHERE id = ?3 AND user_id = ?4`,
    )
    .bind(status, status === 'approved' ? now : null, recommendationId, userId)
    .run();

  const changes = res && typeof res === 'object' ? (res as { changes?: number }).changes : 0;
  if (!changes) {
    return failure({ code: 'NOT_FOUND', message: 'Recommendation not found or access denied' });
  }

  return success({ id: recommendationId, status });
}

export async function approveRecommendationAction(
  input: UpdateRecommendationActionInput,
): Promise<Result<{ id: string; status: string }, UpdateRecommendationActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  const result = await updateRecommendationStatus(input.recommendationId, user.id, 'approved');
  if (!result.ok) {
    logger.error('approveRecommendationAction failed', toError(result.error), {
      userId: user.id,
      recommendationId: input.recommendationId,
    });
  }
  return result;
}

export async function rejectRecommendationAction(
  input: UpdateRecommendationActionInput,
): Promise<Result<{ id: string; status: string }, UpdateRecommendationActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  const result = await updateRecommendationStatus(input.recommendationId, user.id, 'rejected');
  if (!result.ok) {
    logger.error('rejectRecommendationAction failed', toError(result.error), {
      userId: user.id,
      recommendationId: input.recommendationId,
    });
  }
  return result;
}