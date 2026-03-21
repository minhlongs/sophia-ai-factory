/**
 * NPS Survey Logic
 *
 * Handles:
 * - NPS score calculation
 * - 7-day trigger scheduling
 * - Survey eligibility checks
 */

import { createServerClient } from '@/lib/db/client';

export interface NpsResponse {
  orgId: string;
  score: number;
  feedback?: string;
  submittedAt: string;
}

export interface NpsStats {
  totalResponses: number;
  promoters: number; // 9-10
  passives: number; // 7-8
  detractors: number; // 0-6
  npsScore: number; // Promoters% - Detractors%
}

/**
 * Calculate NPS score from responses
 * NPS = % Promoters (9-10) - % Detractors (0-6)
 * Passives (7-8) don't affect the score
 */
export function calculateNpsScore(responses: { score: number }[]): NpsStats {
  const total = responses.length;
  if (total === 0) {
    return {
      totalResponses: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      npsScore: 0,
    };
  }

  const promoters = responses.filter(r => r.score >= 9).length;
  const passives = responses.filter(r => r.score === 7 || r.score === 8).length;
  const detractors = responses.filter(r => r.score <= 6).length;

  const promoterPct = (promoters / total) * 100;
  const detractorPct = (detractors / total) * 100;

  return {
    totalResponses: total,
    promoters,
    passives,
    detractors,
    npsScore: Math.round(promoterPct - detractorPct),
  };
}

/**
 * Check if organization is eligible for NPS survey
 * Criteria:
 * - Has active subscription
 * - Has created at least one proposal
 * - Has not submitted NPS in the last 7 days
 */
export async function checkNpsEligibility(orgId: string): Promise<{
  eligible: boolean;
  reason?: string;
  daysSinceLastSurvey?: number;
}> {
  const db = createServerClient();

  // Check active subscription
  const { data: subscription } = await db
    .from('subscriptions')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .single();

  if (!subscription) {
    return { eligible: false, reason: 'No active subscription' };
  }

  // Check has at least one proposal
  const { count: proposalCount } = await db
    .from('proposals')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  if (!proposalCount || proposalCount === 0) {
    return { eligible: false, reason: 'No proposals created' };
  }

  // Check last NPS submission
  const { data: lastNps } = await db
    .from('customer_feedback')
    .select('submitted_at')
    .eq('org_id', orgId)
    .eq('survey_type', 'nps')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .single();

  if (lastNps) {
    const daysSinceLastSurvey = Math.floor(
      (Date.now() - new Date(lastNps.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastSurvey < 7) {
      return {
        eligible: false,
        reason: 'Survey submitted too recently',
        daysSinceLastSurvey,
      };
    }

    return { eligible: true, daysSinceLastSurvey };
  }

  return { eligible: true };
}

/**
 * Schedule NPS survey for 7 days after subscription
 */
export async function scheduleNpsSurvey(
  orgId: string,
  subscriptionDate: Date
): Promise<boolean> {
  const db = createServerClient();

  const npsDate = new Date(subscriptionDate);
  npsDate.setDate(npsDate.getDate() + 7);

  const { error } = await db.from('scheduled_tasks').insert({
    org_id: orgId,
    task_type: 'nps_survey',
    scheduled_for: npsDate.toISOString(),
    status: 'pending',
  }).select();

  return !error;
}

/**
 * Submit NPS feedback
 */
export async function submitNpsFeedback(
  orgId: string,
  score: number,
  feedback?: string
): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient();

  // Validate score
  if (score < 0 || score > 10) {
    return { success: false, error: 'Invalid NPS score (must be 0-10)' };
  }

  const { error } = await db.from('customer_feedback').insert({
    org_id: orgId,
    survey_type: 'nps',
    responses: { feedback: feedback || null },
    nps_score: score,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get NPS statistics for an organization
 */
export async function getNpsStats(orgId: string): Promise<NpsStats | null> {
  const db = createServerClient();

  const { data: feedbacks } = await db
    .from('customer_feedback')
    .select('nps_score')
    .eq('org_id', orgId)
    .eq('survey_type', 'nps')
    .not('nps_score', 'is', null);

  if (!feedbacks || feedbacks.length === 0) {
    return null;
  }

  const responses = feedbacks
    .filter((f): f is { nps_score: number } => f.nps_score !== null)
    .map(f => ({ score: f.nps_score }));

  return calculateNpsScore(responses);
}
