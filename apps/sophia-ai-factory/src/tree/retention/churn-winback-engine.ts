/**
 * @file churn-winback-engine.ts
 * @description Pure deterministic engine for Churn Risk Hazard scoring and Winback Staircase
 * @layer tree
 */

import { createHmac } from 'crypto';
import type {
  ChurnHazardInput,
  ChurnRiskLevel,
  ChurnWinbackOffer,
} from '@/seed/types/growth-triad-v4-types';

export function calculateChurnHazardScore(input: ChurnHazardInput): number {
  const inactiveFactor = 1 - Math.exp(-Math.pow(0.04 * input.daysSinceLastActive, 1.25));
  const loginDampener = Math.min(0.35, input.loginCount30d * 0.035);
  const burnDampener = Math.min(0.25, (input.mcuBurnRate30d / 1000) * 0.05);
  const ticketPenalty = Math.min(0.3, input.supportTicketCount * 0.1);

  const rawScore = inactiveFactor + ticketPenalty - loginDampener - burnDampener;
  const clamped = Math.max(0, Math.min(1, rawScore));
  return Math.round(clamped * 1000) / 1000;
}

export function classifyChurnRiskLevel(hazardScore: number): ChurnRiskLevel {
  if (hazardScore >= 0.75) return 'CRITICAL';
  if (hazardScore >= 0.5) return 'HIGH';
  if (hazardScore >= 0.25) return 'MEDIUM';
  return 'LOW';
}

export function generateWinbackOffer(
  riskLevel: ChurnRiskLevel,
  planMonthlyPriceUsd: number
): ChurnWinbackOffer {
  const marginFloor = planMonthlyPriceUsd * 0.6; // Keep at least 60% gross margin

  switch (riskLevel) {
    case 'CRITICAL':
      return {
        discountPercentage: 35,
        bonusMcu: 500,
        campaignDurationDays: 7,
        guardedMarginFloorUsd: marginFloor,
      };
    case 'HIGH':
      return {
        discountPercentage: 20,
        bonusMcu: 250,
        campaignDurationDays: 14,
        guardedMarginFloorUsd: marginFloor,
      };
    case 'MEDIUM':
      return {
        discountPercentage: 10,
        bonusMcu: 100,
        campaignDurationDays: 21,
        guardedMarginFloorUsd: marginFloor,
      };
    case 'LOW':
    default:
      return {
        discountPercentage: 0,
        bonusMcu: 0,
        campaignDurationDays: 0,
        guardedMarginFloorUsd: marginFloor,
      };
  }
}

export function createWinbackReactivationToken(
  userId: string,
  secretKey: string,
  timestamp: number
): string {
  const hmac = createHmac('sha256', secretKey);
  hmac.update(`winback:${userId}:${timestamp}`);
  return hmac.digest('hex');
}
