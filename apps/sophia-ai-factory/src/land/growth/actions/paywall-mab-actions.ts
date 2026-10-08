/**
 * @file paywall-mab-actions.ts
 * @description Server Action for Dynamic Paywall Thompson Sampling & Recalibration
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  selectPaywallArmThompson,
  updateArmPosterior,
  calculateRfmWtpScore,
} from '@/tree/monetization/paywall-mab-engine';
import type { PaywallArm, RfmWtpInput } from '@/seed/types/growth-triad-v5-types';

export async function selectPaywallArmAction(params: {
  campaignId: string;
  rfmInput?: RfmWtpInput;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const db = createServerClient();
  const rows = await db
    .prepare(
      `SELECT id, campaign_id as campaignId, price_tier as priceTier,
              price_usd as priceUsd, alpha_success as alphaSuccess,
              beta_failure as betaFailure, impressions, conversions,
              revenue_usd as revenueUsd, is_active as isActive
       FROM mab_paywall_arms
       WHERE campaign_id = ? AND is_active = 1`
    )
    .bind(params.campaignId)
    .all<PaywallArm>();

  const arms = rows.results || [];
  if (arms.length === 0) {
    return { success: false as const, error: 'NO_ACTIVE_ARMS' };
  }

  const wtpModifier = params.rfmInput ? calculateRfmWtpScore(params.rfmInput) : 1.0;
  const selected = selectPaywallArmThompson(arms, wtpModifier);

  return {
    success: true as const,
    selectedArm: selected,
    wtpModifier,
  };
}

export async function recordPaywallConversionAction(params: {
  campaignId: string;
  armId: string;
  converted: boolean;
  rfmInput?: RfmWtpInput;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false as const, error: 'UNAUTHORIZED' };
  }

  const db = createServerClient();
  const arm = await db
    .prepare(
      `SELECT id, campaign_id as campaignId, price_tier as priceTier,
              price_usd as priceUsd, alpha_success as alphaSuccess,
              beta_failure as betaFailure, impressions, conversions,
              revenue_usd as revenueUsd, is_active as isActive
       FROM mab_paywall_arms
       WHERE id = ?`
    )
    .bind(params.armId)
    .first<PaywallArm>();

  if (!arm) {
    return { success: false as const, error: 'ARM_NOT_FOUND' };
  }

  const wtpScore = params.rfmInput ? calculateRfmWtpScore(params.rfmInput) : 1.0;
  const updated = updateArmPosterior(arm, params.converted, wtpScore);
  const now = Date.now();

  await db
    .prepare(
      `UPDATE mab_paywall_arms
       SET alpha_success = ?, beta_failure = ?, impressions = ?,
           conversions = ?, revenue_usd = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      updated.alphaSuccess,
      updated.betaFailure,
      updated.impressions,
      updated.conversions,
      updated.revenueUsd,
      now,
      params.armId
    )
    .run();

  await inngest.send({
    name: 'paywall.mab.recalibrated',
    data: {
      campaignId: params.campaignId,
      winningArmId: params.armId,
      priceUsd: updated.priceUsd,
      expectedRevenue: updated.revenueUsd,
    },
  });

  return {
    success: true as const,
    updatedArm: updated,
  };
}
