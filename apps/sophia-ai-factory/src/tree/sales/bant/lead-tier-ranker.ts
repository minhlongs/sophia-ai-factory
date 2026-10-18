/**
 * BANT Need & Timeline Evaluator and Funnel Classification
 *
 * Implements Need, Timeline scoring, and funnel classification (Hot, Warm, Cold).
 *
 * Layer: tree/sales/bant
 */

import type {
  BantScoreInput,
  BantFactorBreakdown,
} from '@/seed/types/enterprise-deal';
import { scoreTimeline, classifyFunnelTier } from './timeline-funnel-classifier';

export { scoreTimeline, classifyFunnelTier };

/**
 * Evaluates the Need factor (0–25 points).
 */
export function scoreNeed(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  const reasons: string[] = [];
  const details: Record<string, unknown> = {};

  if (input.needsHighVolumeSyndication) {
    score += 7;
    reasons.push('High-volume syndication across YouTube/TikTok/Reels (+7)');
    details.highVolumeSyndication = true;
  }

  if (input.needsApacDubbing) {
    score += 6;
    reasons.push('APAC 5-language native voice dubbing (+6)');
    details.apacDubbing = true;
  }

  if (input.needsDedicatedGpuLane) {
    score += 5;
    reasons.push('Dedicated GPU lane & sub-second SLA (+5)');
    details.dedicatedGpu = true;
  }

  if (input.needsCustomApiOrWhiteLabel) {
    score += 4;
    reasons.push('Custom API / Agency white-label integration (+4)');
    details.whiteLabelOrApi = true;
  }

  const painPoint = (input.statedBottleneckOrPainPoint || '').trim();
  if (painPoint.length > 10) {
    score += 3;
    reasons.push('Articulated high production cost or bottleneck (+3)');
    details.bottleneckStated = true;
  }

  const tags = input.needTags || [];
  if (tags.length > 0 && score < 15) {
    const tagBoost = Math.min(6, tags.length * 2);
    score += tagBoost;
    reasons.push(`Specified requirement tags (+${tagBoost})`);
    details.tagsCount = tags.length;
  }

  // Minimum floor if any requirement indicated
  if (reasons.length === 0) {
    score = 2;
    reasons.push('General evaluation without specific enterprise workload');
  }

  score = Math.max(0, Math.min(25, Math.round(score)));

  return {
    score,
    maxScore: 25,
    factor: 'need',
    reason: reasons.join('; '),
    details,
  };
}
