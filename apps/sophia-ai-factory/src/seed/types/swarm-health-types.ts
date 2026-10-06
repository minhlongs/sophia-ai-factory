/**
 * Customer Health & Churn Retention Contracts & Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/swarm-health-types
 */

export const HEALTH_TIERS = ['green', 'yellow', 'red', 'critical'] as const;
export type HealthTier = (typeof HEALTH_TIERS)[number];

export const TREND_DIRECTIONS = ['improving', 'stable', 'declining', 'rapid_drop'] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

export interface CustomerHealthMetricRow {
  id: string;
  customer_id: string;
  org_id: string | null;
  period_start: number;
  period_end: number;
  active_agents_count: number;
  video_generation_count: number;
  api_request_count: number;
  api_error_count: number;
  api_error_rate: number;
  login_frequency_7d: number;
  mcu_consumption_rate: number;
  nps_score: number | null;
  churn_risk_score: number;
  health_tier: HealthTier;
  trend_direction: TrendDirection;
  risk_factors_json: string;
  last_activity_at: number | null;
  evaluated_at: number;
  created_at: number;
}

export interface CustomerHealthMetric {
  id: string;
  customerId: string;
  orgId: string | null;
  periodStart: number;
  periodEnd: number;
  activeAgentsCount: number;
  videoGenerationCount: number;
  apiRequestCount: number;
  apiErrorCount: number;
  apiErrorRate: number;
  loginFrequency7d: number;
  mcuConsumptionRate: number;
  npsScore: number | null;
  churnRiskScore: number;
  healthTier: HealthTier;
  trendDirection: TrendDirection;
  riskFactors: string[];
  lastActivityAt: number | null;
  evaluatedAt: number;
  createdAt: number;
}

export interface CustomerHealthTelemetryInput {
  customerId: string;
  orgId?: string | null;
  activeAgentsCount: number;
  videoGenerationCount: number;
  apiRequestCount: number;
  apiErrorCount: number;
  loginFrequency7d: number;
  mcuConsumptionRate: number;
  lastActivityAt?: number | null;
  npsScore?: number | null;
  previousChurnRiskScore?: number | null;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToCustomerHealthMetric(row: CustomerHealthMetricRow): CustomerHealthMetric {
  return {
    id: row.id,
    customerId: row.customer_id,
    orgId: row.org_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    activeAgentsCount: row.active_agents_count,
    videoGenerationCount: row.video_generation_count,
    apiRequestCount: row.api_request_count,
    apiErrorCount: row.api_error_count,
    apiErrorRate: row.api_error_rate,
    loginFrequency7d: row.login_frequency_7d,
    mcuConsumptionRate: row.mcu_consumption_rate,
    npsScore: row.nps_score,
    churnRiskScore: row.churn_risk_score,
    healthTier: row.health_tier,
    trendDirection: row.trend_direction,
    riskFactors: safeParseJson<string[]>(row.risk_factors_json, []),
    lastActivityAt: row.last_activity_at,
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
  };
}
