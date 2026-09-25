/**
 * BANT 4-Factor Scoring Service & Funnel Classification Engine
 *
 * Implements deterministic qualification across:
 * - Budget (0-25): Stated ARR, monthly MCU volume, and enriched revenue tier
 * - Authority (0-25): Stakeholder seniority, title parsing, and corporate email verification
 * - Need (0-25): High-volume syndication, APAC dubbing, dedicated GPU, white-label API, and pain points
 * - Timeline (0-25): Implementation urgency and buying horizon
 *
 * Total BANT Score: 0 - 100
 * Funnel Tiers:
 * - Hot (Score >= 75): High-velocity executive engagement & instant sandbox demo
 * - Warm (Score 50 - 74): Nurturing, personalized case studies, discovery follow-up
 * - Cold (Score < 50): Automated educational drip & self-service onboarding
 *
 * Layer: tree/sales (Pure domain logic - only imports from @/seed)
 *
 * @module tree/sales/bant-scoring-service
 */

import type {
  BantScoreInput,
  BantScoreResult,
  BantAnalysis,
  BantFactorBreakdown,
  PipelineTier,
} from '@/seed/types/enterprise-deal';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
]);

/**
 * Checks whether an email address belongs to a corporate custom domain.
 */
export function isCorporateEmailDomain(email?: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}

/**
 * Evaluates the Budget factor (0–25 points).
 */
export function scoreBudget(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const arr = input.statedBudgetArr ?? 0;
  const mcu = input.statedMonthlyMcu ?? 0;
  const rev = (input.companyRevenueRange || '').toUpperCase();

  if (arr >= 100_000 || mcu >= 250_000) {
    score = 25;
    reason = 'Enterprise budget >= $100K ARR or >= 250K MCU/mo';
  } else if (arr >= 50_000 || mcu >= 100_000) {
    score = 20;
    reason = 'Mid-market high budget ($50K-$99K ARR or >= 100K MCU/mo)';
  } else if (arr >= 25_000 || mcu >= 50_000) {
    score = 16;
    reason = 'Established budget ($25K-$49K ARR or >= 50K MCU/mo)';
  } else if (arr >= 10_000) {
    score = 12;
    reason = 'Starter commercial budget ($10K-$24K ARR)';
  } else if (arr > 0) {
    score = 5;
    reason = 'Small pilot budget (< $10K ARR)';
  } else {
    // Inferred from revenue range if stated budget is not provided
    if (rev.includes('<1M') || rev.includes('<$1M') || rev.includes('< $1M')) {
      score = 5;
      reason = 'Startup/SMB or small budget tier (< $1M)';
    } else if (rev.includes('>50M') || rev.includes('> $50M') || rev.includes('50M+')) {
      score = 20;
      reason = 'Unstated budget; inferred from enterprise company revenue (> $50M)';
    } else if (rev.includes('10M-50M') || rev.includes('10M - 50M') || (rev.includes('50M') && !rev.includes('1M-10M'))) {
      score = 15;
      reason = 'Unstated budget; inferred from mid-market company revenue ($10M-$50M)';
    } else if (rev.includes('1M-10M') || rev.includes('1M - 10M') || rev.includes('10M') || rev.includes('1M')) {
      score = 10;
      reason = 'Unstated budget; inferred from growth company revenue ($1M-$10M)';
    } else {
      score = 5;
      reason = 'Startup/SMB or unspecified budget tier';
    }
  }

  // Bonus for verified large company revenue
  if (arr > 0 && (rev.includes('>50M') || rev.includes('> $50M') || rev.includes('50M+'))) {
    score = Math.min(25, score + 5);
    reason += ' + revenue bonus (> $50M)';
    details.revenueBonus = 5;
  } else if (arr > 0 && (rev.includes('10M-50M') || rev.includes('10M - 50M') || (rev.includes('50M') && !rev.includes('1M-10M')))) {
    score = Math.min(25, score + 3);
    reason += ' + revenue bonus ($10M-$50M)';
    details.revenueBonus = 3;
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.statedBudgetArr = arr;
  details.statedMonthlyMcu = mcu;
  details.companyRevenueRange = rev;

  return {
    score,
    maxScore: 25,
    factor: 'budget',
    reason,
    details,
  };
}

/**
 * Evaluates the Authority factor (0–25 points).
 */
export function scoreAuthority(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const title = (input.jobTitle || '').toLowerCase().trim();
  const isCorporate = input.isCorporateEmail ?? isCorporateEmailDomain(input.leadEmail);

  const cLevelRegex = /\b(ceo|chief executive|cto|chief technology|cmo|chief marketing|cro|coo|founder|co-founder|president|owner)\b/i;
  const vpRegex = /\b(vp|vice president|head of|managing director|general manager)\b/i;
  const directorRegex = /\b(director|principal|lead architect|chief architect)\b/i;
  const managerRegex = /\b(senior manager|lead|project lead|team lead|manager)\b/i;

  if (cLevelRegex.test(title)) {
    score = 22;
    reason = 'Executive Decision Maker (C-Level / Founder / President)';
  } else if (vpRegex.test(title)) {
    score = 18;
    reason = 'Senior Leadership (VP / Head of Department / MD)';
  } else if (directorRegex.test(title)) {
    score = 15;
    reason = 'Technical or Business Director / Principal';
  } else if (managerRegex.test(title)) {
    score = 10;
    reason = 'Department Manager / Team Lead';
  } else if (title.length > 0) {
    score = 4;
    reason = 'Individual Contributor / Specialist';
  } else {
    score = 2;
    reason = 'Unspecified role';
  }


  if (isCorporate) {
    score = Math.min(25, score + 3);
    reason += ' + verified corporate domain bonus (+3)';
    details.corporateDomainBonus = true;
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.jobTitle = input.jobTitle || 'N/A';
  details.isCorporateEmail = isCorporate;

  return {
    score,
    maxScore: 25,
    factor: 'authority',
    reason,
    details,
  };
}

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

/**
 * Evaluates the Timeline factor (0–25 points).
 */
export function scoreTimeline(input: BantScoreInput): BantFactorBreakdown {
  let score = 0;
  let reason = '';
  const details: Record<string, unknown> = {};

  const tf = (input.timeframe || '').toLowerCase().trim();

  if (
    tf === 'immediate' ||
    tf.includes('asap') ||
    tf.includes('< 1 month') ||
    tf.includes('now') ||
    tf.includes('urgent')
  ) {
    score = 25;
    reason = 'Immediate rollout / ASAP (< 1 month)';
  } else if (
    tf === '1_to_3_months' ||
    tf.includes('1-3') ||
    tf.includes('current quarter') ||
    tf.includes('q1') ||
    tf.includes('q2') ||
    tf.includes('q3') ||
    tf.includes('q4')
  ) {
    score = 20;
    reason = 'Current quarter rollout (1–3 months)';
  } else if (tf === '3_to_6_months' || tf.includes('3-6') || tf.includes('next quarter')) {
    score = 12;
    reason = 'Next quarter roadmap (3–6 months)';
  } else if (tf === '6_to_12_months' || tf.includes('6-12') || tf.includes('next year')) {
    score = 5;
    reason = 'Long-term evaluation (6–12 months)';
  } else if (tf === 'exploring' || tf.includes('browse') || tf.includes('info')) {
    score = 2;
    reason = 'Early exploratory inquiry / no firm timeline';
  } else {
    score = 5;
    reason = 'Standard default exploratory timeline';
  }

  score = Math.max(0, Math.min(25, Math.round(score)));
  details.timeframe = input.timeframe || 'unspecified';

  return {
    score,
    maxScore: 25,
    factor: 'timeline',
    reason,
    details,
  };
}

/**
 * Classifies a total BANT score into Hot, Warm, or Cold pipeline tier.
 */
export function classifyFunnelTier(totalScore: number): PipelineTier {
  if (totalScore >= 75) return 'hot';
  if (totalScore >= 50) return 'warm';
  return 'cold';
}

/**
 * Computes full deterministic BANT qualification and returns structured result.
 */
export function calculateBantScore(input: BantScoreInput): BantScoreResult {
  const budget = scoreBudget(input);
  const authority = scoreAuthority(input);
  const need = scoreNeed(input);
  const timeline = scoreTimeline(input);

  const totalScore = budget.score + authority.score + need.score + timeline.score;
  const pipelineTier = classifyFunnelTier(totalScore);

  let recommendation = '';
  if (pipelineTier === 'hot') {
    recommendation =
      'Immediate executive outreach. Auto-generate custom bilingual proposal, provision 1,000 demo MCU sandbox workspace, and schedule C-Level demo call within 24 hours.';
  } else if (pipelineTier === 'warm') {
    recommendation =
      'Assign to sales discovery cadence. Dispatch targeted case studies, showcase relevant video reel benchmarks, and follow up in 3 business days.';
  } else {
    recommendation =
      'Route to self-service onboarding drip. Enroll in video automation newsletter and invite to monthly group webinar.';
  }

  const analysis: BantAnalysis = {
    budget,
    authority,
    need,
    timeline,
    totalScore,
    tier: pipelineTier,
    recommendation,
    qualifiedAt: Date.now(),
  };

  return {
    totalScore,
    budgetScore: budget.score,
    authorityScore: authority.score,
    needScore: need.score,
    timelineScore: timeline.score,
    pipelineTier,
    analysis,
  };
}
