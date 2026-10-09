'use server';

/**
 * Land Layer: Growth Triad v15 Server Actions
 * Dispatches ingest actions and reads Bayesian performance feedback telemetry.
 * Layer: land/growth-v15 | Max LOC: < 200 | Zero :any
 * @module land/growth-v15/feedback-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import {
  PostPublishFeedbackSchema,
  type PostPublishFeedback,
  type BayesianFeedbackSummary,
} from '@/seed/types/growth-triad-v15';
import {
  ingestPostPublishFeedback,
  getFeedbackSummary,
} from './feedback-coordinator';

export async function submitPostPublishFeedbackAction(
  rawInput: unknown
): Promise<Result<{ ingested: boolean }, { code: string; message: string }>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'User must be authenticated' });
  }

  const parsed = PostPublishFeedbackSchema.safeParse(rawInput);
  if (!parsed.success) {
    return failure({
      code: 'INVALID_INPUT',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    });
  }

  const feedback: PostPublishFeedback = {
    ...parsed.data,
    userId: user.id,
  };

  const ok = await ingestPostPublishFeedback(feedback);
  if (!ok) {
    return failure({
      code: 'INGEST_FAILED',
      message: 'Failed to persist post-publish feedback record',
    });
  }

  return success({ ingested: true });
}

export async function getFeedbackSummaryAction(): Promise<
  Result<BayesianFeedbackSummary, { code: string; message: string }>
> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'User must be authenticated' });
  }

  const summary = await getFeedbackSummary(user.id);
  return success(summary);
}
