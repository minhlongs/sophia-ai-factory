/**
 * Cooldown Verification & Candidate Actions Resolution
 *
 * @module tree/swarm/retention-flywheel/cooldown-resolver
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  SwarmInterventionType,
} from '@/seed/types/autonomous-swarm';
import { INTERVENTION_COOLDOWN_MS } from './types';

/**
 * Checks if an intervention of a specific type has already been triggered
 * for the customer within the cooldown window (default: 7 days).
 */
export async function isInterventionInCooldown(
  db: D1Database,
  customerId: string,
  interventionType: SwarmInterventionType,
  cooldownMs: number = INTERVENTION_COOLDOWN_MS
): Promise<boolean> {
  const cutoff = Date.now() - cooldownMs;
  const row = await db
    .prepare(`
      SELECT id FROM swarm_intervention_events
      WHERE customer_id = ?1
        AND intervention_type = ?2
        AND created_at >= ?3
        AND status NOT IN ('failed', 'rejected')
      LIMIT 1
    `)
    .bind(customerId, interventionType, cutoff)
    .first<{ id: string }>();

  return Boolean(row);
}

/**
 * Determines candidate intervention actions based on customer health tier.
 */
export function resolveCandidateActions(
  metric: CustomerHealthMetric
): Array<{ type: SwarmInterventionType; payload: Record<string, unknown> }> {
  const candidateActions: Array<{
    type: SwarmInterventionType;
    payload: Record<string, unknown>;
  }> = [];

  if (metric.healthTier === 'critical') {
    candidateActions.push({
      type: 'cs_escalation',
      payload: { priority: 'P1', reason: 'Critical churn risk >= 0.75', riskFactors: metric.riskFactors },
    });
    candidateActions.push({
      type: 'bonus_credits',
      payload: { creditAmountMcu: 10_000, grantReason: 'Retention intervention credit grant' },
    });
  } else if (metric.healthTier === 'red') {
    candidateActions.push({
      type: 'bonus_credits',
      payload: { creditAmountMcu: 5_000, grantReason: 'Tier red win-back grant' },
    });
    candidateActions.push({
      type: 'feature_reengagement',
      payload: { suggestedFeatures: ['apac_dubbing', 'creator_marketplace', 'bulk_syndication'] },
    });
  } else if (metric.healthTier === 'yellow') {
    candidateActions.push({
      type: 'onboarding_guide',
      payload: { playbookSlug: 'video-automation-mastery', language: 'bilingual' },
    });
  }

  if (metric.apiErrorRate > 0.05) {
    candidateActions.push({
      type: 'automated_health_check',
      payload: { errorRatePct: Number((metric.apiErrorRate * 100).toFixed(2)), diagnosticRef: 'api_edge_remediation' },
    });
  }

  return candidateActions;
}
