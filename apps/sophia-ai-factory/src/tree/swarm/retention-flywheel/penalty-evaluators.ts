/**
 * Factor Penalty Evaluators & Tier/Trend Classifiers for Retention Flywheel
 *
 * Layer: tree/swarm/retention-flywheel
 *
 * @module tree/swarm/retention-flywheel/penalty-evaluators
 */

import type {
  HealthTier,
  TrendDirection,
} from '@/seed/types/autonomous-swarm';

export function evaluateAgentPenalty(count: number, riskFactors: string[]): number {
  if (count >= 3) return 0.0;
  if (count >= 1) {
    riskFactors.push('low_active_agents_count');
    return 0.10;
  }
  riskFactors.push('zero_active_agents');
  return 0.25;
}

export function evaluateVideoPenalty(count: number, riskFactors: string[]): number {
  if (count >= 10) return 0.0;
  if (count >= 5) {
    riskFactors.push('moderate_video_generation_drop');
    return 0.10;
  }
  if (count >= 1) {
    riskFactors.push('low_video_generation_velocity');
    return 0.20;
  }
  riskFactors.push('zero_video_generation');
  return 0.35;
}

export function evaluateApiPenalty(requests: number, errors: number, riskFactors: string[]): number {
  const errorRate = requests > 0 ? errors / requests : 0.0;
  if (errorRate <= 0.01) return 0.0;
  if (errorRate <= 0.05) {
    riskFactors.push('elevated_api_error_rate_1_to_5_pct');
    return 0.10;
  }
  riskFactors.push('critical_api_error_spike_above_5_pct');
  return 0.20;
}

export function evaluateRecencyPenalty(logins7d: number, riskFactors: string[]): number {
  if (logins7d >= 4) return 0.0;
  if (logins7d >= 1) {
    riskFactors.push('low_login_frequency_under_4x');
    return 0.08;
  }
  riskFactors.push('zero_logins_in_7d');
  return 0.20;
}

export function resolveHealthTier(score: number): HealthTier {
  if (score >= 0.75) return 'critical';
  if (score >= 0.50) return 'red';
  if (score >= 0.25) return 'yellow';
  return 'green';
}

export function resolveTrendDirection(current: number, previous?: number | null): TrendDirection {
  if (previous === undefined || previous === null) return 'stable';
  const delta = current - previous;
  if (delta <= -0.10) return 'improving';
  if (delta >= 0.25) return 'rapid_drop';
  if (delta >= 0.10) return 'declining';
  return 'stable';
}
