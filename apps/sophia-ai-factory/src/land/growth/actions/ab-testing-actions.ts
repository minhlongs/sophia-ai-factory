/**
 * @file ab-testing-actions.ts
 * @description Server Action for Hook A/B Significance Evaluation & Winner Promotion
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { evaluateExperimentSignificance } from '@/tree/ab-testing/bayesian-ctr-tester';
import type { AbVariant } from '@/seed/types/growth-triad-v5-types';

export async function evaluateAndPromoteWinnerAction(params: {
  experimentId: string;
  minImpressions?: number;
  confidenceThreshold?: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const db = createServerClient();
  const exp = await db
    .prepare('SELECT id, title, status, variants_json FROM hook_ab_experiments WHERE id = ?')
    .bind(params.experimentId)
    .first<{ id: string; title: string; status: string; variants_json: string }>();

  if (!exp) {
    return { success: false as const, error: 'EXPERIMENT_NOT_FOUND' };
  }

  const variants: AbVariant[] = JSON.parse(exp.variants_json);
  const evaluation = evaluateExperimentSignificance(
    variants,
    params.minImpressions ?? 200,
    params.confidenceThreshold ?? 0.95
  );

  const now = Date.now();
  if (evaluation.hasSignificantWinner && evaluation.winnerVariantId) {
    const updatedVariants = variants.map((v) => ({
      ...v,
      isPromotedWinner: v.id === evaluation.winnerVariantId,
    }));

    await db
      .prepare(
        `UPDATE hook_ab_experiments
         SET status = 'CALCULATING_SIGNIFICANCE',
             variants_json = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(JSON.stringify(updatedVariants), now, params.experimentId)
      .run();

    await inngest.send({
      name: 'hook.ab.winner.promoted',
      data: {
        experimentId: params.experimentId,
        winnerVariantId: evaluation.winnerVariantId,
        confidenceLevelPct: evaluation.confidenceLevelPct,
      },
    });
  }

  return {
    success: true as const,
    experimentId: params.experimentId,
    evaluation,
  };
}
