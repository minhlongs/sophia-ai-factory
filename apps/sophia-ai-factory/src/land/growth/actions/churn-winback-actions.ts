/**
 * @file churn-winback-actions.ts
 * @description Server Action for Churn Hazard Evaluation & Win-Back Discount Staircase
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  calculateChurnHazardScore,
  classifyChurnRiskLevel,
  generateWinbackOffer,
} from '@/tree/retention/churn-winback-engine';
import type { ChurnHazardInput } from '@/seed/types/growth-triad-v4-types';

export async function evaluateChurnWinbackAction(params: {
  targetUserId: string;
  hazardInput: ChurnHazardInput;
  planMonthlyPriceUsd: number;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const score = calculateChurnHazardScore(params.hazardInput);
  const riskLevel = classifyChurnRiskLevel(score);
  const offer = generateWinbackOffer(riskLevel, params.planMonthlyPriceUsd);

  const now = Date.now();
  const recordId = `wb_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const db = createServerClient();

  await db
    .prepare(
      `INSERT INTO churn_winback_records (
         id, user_id, days_inactive, churn_hazard_score,
         risk_level, discount_percentage, bonus_mcu,
         status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recordId,
      params.targetUserId,
      params.hazardInput.daysSinceLastActive,
      score,
      riskLevel,
      offer.discountPercentage,
      offer.bonusMcu,
      'EVALUATED',
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'retargeting.winback.evaluated',
    data: {
      userId: params.targetUserId,
      recordId,
      riskLevel,
      discountPercentage: offer.discountPercentage,
      bonusMcu: offer.bonusMcu,
    },
  });

  return {
    success: true as const,
    recordId,
    hazardScore: score,
    riskLevel,
    offer,
  };
}
