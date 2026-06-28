# Phase 4: AGI-Era — Implementation Plan

**Status:** IN PROGRESS
**Depends on:** Phase 3 (in progress)

---

## Tasks

### Task J: Outcome-Based Pricing Schema
Track outcome-based pricing (% of creator revenue from SOP outputs).
- CREATE: `src/seed/db/migrations/20260522_outcome_pricing.sql` — `outcome_pricing_tiers` + `outcome_billing_events` tables
- CREATE: `migrations/0134_outcome_pricing.sql` — canonical copy
- CREATE: `src/seed/types/outcome-pricing.ts` — PricingModel, OutcomePricingTier, BillingEvent types
- CREATE: `src/tree/billing/outcome-pricing-engine.ts` — calculateFee (15% default), createBillingEvent, getCreatorBillingSummary
- Types: pricing_tier (id, name, percentage, min_revenue_cents, max_revenue_cents, is_active), billing_event (id, user_id, execution_id, outcome_id, gross_revenue_cents, fee_cents, fee_percentage, status, created_at)

### Task K: Agent API Schema
REST API schema for programmatic SOP execution requests from external agents.
- CREATE: `src/seed/db/migrations/20260522_agent_api.sql` — `api_keys` + `api_request_log` tables
- CREATE: `migrations/0135_agent_api.sql` — canonical copy
- CREATE: `src/seed/types/agent-api.ts` — ApiKey, ApiRequestLog, ApiRateLimit types
- CREATE: `src/tree/api/agent-api-auth.ts` — validateApiKey, logApiRequest, checkRateLimit, generateApiKey
- Types: api_key (id, user_id, key_hash, name, permissions_json, rate_limit_rpm, is_active, last_used_at, created_at), request_log (id, api_key_id, endpoint, method, status_code, duration_ms, created_at)

### Task L: Performance Feedback Loop Schema
7-day post-publish feedback loop for SOP prompt optimization.
- CREATE: `src/seed/db/migrations/20260522_performance_feedback.sql` — `performance_feedback_cycles` + `prompt_optimization_log` tables
- CREATE: `migrations/0136_performance_feedback.sql` — canonical copy
- CREATE: `src/seed/types/performance-feedback.ts` — FeedbackCycle, PromptOptimization, FeedbackStatus types
- CREATE: `src/tree/sop/performance-feedback-engine.ts` — createFeedbackCycle, evaluatePerformance, suggestOptimization, applyOptimization
- Types: cycle (id, execution_id, sop_id, published_at, evaluate_at, status, metrics_json, created_at), optimization (id, cycle_id, sop_id, step_index, original_prompt, suggested_prompt, improvement_score, applied, created_at)

### Task M: Compliance Metadata Schema
AI disclosure + C2PA metadata tracking for regulatory compliance.
- CREATE: `src/seed/db/migrations/20260522_compliance.sql` — `compliance_metadata` table
- CREATE: `migrations/0137_compliance.sql` — canonical copy
- CREATE: `src/seed/types/compliance.ts` — ComplianceRecord, ComplianceType, C2PAMetadata types
- CREATE: `src/tree/compliance/compliance-tracker.ts` — recordDisclosure, addC2PAMetadata, getComplianceReport, isCompliant
- Types: compliance (id, execution_id, content_id, user_id, compliance_type, metadata_json, platform, verified, created_at)
- Compliance types: ai_disclosure, c2pa_metadata, platform_tos_check, copyright_check

## Success Criteria
- tsc clean, npm run build passes, npm test passes
- 6 new D1 tables with indexes
- Outcome pricing engine with configurable fee %
- Agent API auth with key hashing + rate limiting
- Performance feedback supports 7-day evaluation cycles
- Compliance tracker ready for AI disclosure requirements
