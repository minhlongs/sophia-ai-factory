-- Migration 0308: Predictive LTV/Churn ML & Enterprise Account Expansion Engine
-- Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
-- Standards: Cloudflare D1 SQLite, millisecond Unix timestamps, strict CHECK constraints, random hex UUIDs.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. customer_predictive_scores
-- Stores multi-factor churn probability, 24-month LTV forecast, and expansion readiness.
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer_predictive_scores (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  customer_id TEXT NOT NULL, -- references users.id or organizations.id
  org_id TEXT, -- optional enterprise organization scope
  current_tier TEXT NOT NULL CHECK(current_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  tenure_days INTEGER NOT NULL DEFAULT 0 CHECK(tenure_days >= 0),
  current_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(current_mrr_cents >= 0),
  predicted_mrr_24m_cents INTEGER NOT NULL DEFAULT 0 CHECK(predicted_mrr_24m_cents >= 0),
  churn_probability REAL NOT NULL DEFAULT 0.0 CHECK(churn_probability >= 0.0 AND churn_probability <= 1.0),
  forecast_ltv_24m_cents INTEGER NOT NULL DEFAULT 0 CHECK(forecast_ltv_24m_cents >= 0),
  expansion_readiness_score REAL NOT NULL DEFAULT 0.0 CHECK(expansion_readiness_score >= 0.0 AND expansion_readiness_score <= 1.0),
  health_score REAL NOT NULL DEFAULT 1.0 CHECK(health_score >= 0.0 AND health_score <= 1.0),
  confidence_score REAL NOT NULL DEFAULT 0.95 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
  expansion_stage TEXT NOT NULL DEFAULT 'nurture' CHECK(expansion_stage IN ('nurture', 'ready', 'engaged', 'negotiating', 'expanded', 'stalled')),
  feature_weights_json TEXT NOT NULL DEFAULT '{}', -- weights of quota_saturation, usage_velocity, error_rate, login_cadence
  recommended_action TEXT NOT NULL DEFAULT 'maintain' CHECK(recommended_action IN (
    'maintain', 'proactive_retention', 'quota_expansion', 'tier_upgrade', 'enterprise_gpu_lane', 'custom_contract'
  )),
  evaluated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_cps_customer ON customer_predictive_scores(customer_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cps_churn_risk ON customer_predictive_scores(risk_level, churn_probability DESC);
CREATE INDEX IF NOT EXISTS idx_cps_expansion ON customer_predictive_scores(expansion_stage, expansion_readiness_score DESC);
CREATE INDEX IF NOT EXISTS idx_cps_evaluated ON customer_predictive_scores(evaluated_at DESC);

-- ============================================================================
-- 2. expansion_recommendations
-- Automated tier upgrade recommendations (BASIC -> PREMIUM -> ENTERPRISE) and GPU/MCU expansion.
-- ============================================================================
CREATE TABLE IF NOT EXISTS expansion_recommendations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  customer_id TEXT NOT NULL,
  org_id TEXT,
  score_id TEXT REFERENCES customer_predictive_scores(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL CHECK(recommendation_type IN (
    'tier_upgrade', 'mcu_quota_expansion', 'dedicated_gpu_lane', 'custom_enterprise_sla'
  )),
  current_tier TEXT NOT NULL CHECK(current_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  target_tier TEXT CHECK(target_tier IS NULL OR target_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  current_mcu_quota INTEGER NOT NULL DEFAULT 1000 CHECK(current_mcu_quota >= 0),
  recommended_mcu_quota INTEGER NOT NULL DEFAULT 5000 CHECK(recommended_mcu_quota >= current_mcu_quota),
  current_gpu_lanes INTEGER NOT NULL DEFAULT 0 CHECK(current_gpu_lanes >= 0),
  recommended_gpu_lanes INTEGER NOT NULL DEFAULT 0 CHECK(recommended_gpu_lanes >= current_gpu_lanes),
  current_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(current_mrr_cents >= 0),
  projected_expansion_mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(projected_expansion_mrr_cents >= 0),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'pending', 'notified', 'in_review', 'accepted', 'automated_applied', 'declined', 'expired'
  )),
  confidence_score REAL NOT NULL DEFAULT 0.85 CHECK(confidence_score >= 0.0 AND confidence_score <= 1.0),
  triggers_json TEXT NOT NULL DEFAULT '[]',
  rationale_vi TEXT NOT NULL,
  rationale_en TEXT NOT NULL,
  discount_offer_pct REAL NOT NULL DEFAULT 0.0 CHECK(discount_offer_pct >= 0.0 AND discount_offer_pct <= 50.0),
  applied_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_er_customer ON expansion_recommendations(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_er_status_priority ON expansion_recommendations(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_er_type_status ON expansion_recommendations(recommendation_type, status);
CREATE INDEX IF NOT EXISTS idx_er_expires ON expansion_recommendations(expires_at);

-- ============================================================================
-- 3. investor_relations_forecasts
-- 12-month revenue forecast with Monte Carlo confidence intervals for Investor Relations & Board Reports.
-- ============================================================================
CREATE TABLE IF NOT EXISTS investor_relations_forecasts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  forecast_batch_id TEXT NOT NULL,
  forecast_period_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  horizon_month_offset INTEGER NOT NULL CHECK(horizon_month_offset >= 1 AND horizon_month_offset <= 12),
  baseline_mrr_cents INTEGER NOT NULL CHECK(baseline_mrr_cents >= 0),
  p10_pessimistic_mrr_cents INTEGER NOT NULL CHECK(p10_pessimistic_mrr_cents >= 0),
  p50_expected_mrr_cents INTEGER NOT NULL CHECK(p50_expected_mrr_cents >= p10_pessimistic_mrr_cents),
  p90_optimistic_mrr_cents INTEGER NOT NULL CHECK(p90_optimistic_mrr_cents >= p50_expected_mrr_cents),
  p99_bull_case_mrr_cents INTEGER NOT NULL CHECK(p99_bull_case_mrr_cents >= p90_optimistic_mrr_cents),
  simulated_iterations INTEGER NOT NULL DEFAULT 10000 CHECK(simulated_iterations > 0),
  expected_active_customers INTEGER NOT NULL CHECK(expected_active_customers >= 0),
  expected_arpu_cents INTEGER NOT NULL CHECK(expected_arpu_cents >= 0),
  projected_nrr_pct REAL NOT NULL CHECK(projected_nrr_pct >= 0.0),
  projected_grr_pct REAL NOT NULL CHECK(projected_grr_pct >= 0.0 AND projected_grr_pct <= 100.0),
  projected_churn_rate_pct REAL NOT NULL CHECK(projected_churn_rate_pct >= 0.0 AND projected_churn_rate_pct <= 100.0),
  projected_expansion_rate_pct REAL NOT NULL CHECK(projected_expansion_rate_pct >= 0.0),
  target_mrr_cents INTEGER NOT NULL DEFAULT 250000000, -- $2,500,000 USD
  target_customers INTEGER NOT NULL DEFAULT 10000,
  target_arpu_cents INTEGER NOT NULL DEFAULT 25000, -- $250 USD
  probability_achieving_target REAL NOT NULL CHECK(probability_achieving_target >= 0.0 AND probability_achieving_target <= 1.0),
  assumptions_json TEXT NOT NULL DEFAULT '{}',
  is_approved_for_board INTEGER NOT NULL DEFAULT 0 CHECK(is_approved_for_board IN (0, 1)),
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_irf_batch_offset ON investor_relations_forecasts(forecast_batch_id, horizon_month_offset);
CREATE INDEX IF NOT EXISTS idx_irf_period ON investor_relations_forecasts(forecast_period_month);
CREATE INDEX IF NOT EXISTS idx_irf_board ON investor_relations_forecasts(is_approved_for_board);
