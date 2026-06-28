# Phase 7: Architecture Impact Analysis

## 4-Layer Compliance Check

All 4 features follow the seed → tree → forest → land architecture:

```
Feature A (Analytics):
  seed/db/migrations/0161_outcome_tracking.sql  → new types
  tree/analytics/step-metrics.ts                → domain logic
  forest/analytics/sop-outcome-tracker.ts       → orchestration
  (no land — read-only analytics)

Feature B (AI Auto-Create):
  tree/ai/prompt-templates/sop-generation.ts    → prompt engineering
  forest/agents/sop-creator-agent.ts            → agent orchestration
  land/sop-creator/auto-generate.ts             → business workflow

Feature C (Creator Revenue):
  tree/affiliates/payout-calculator.ts          → calculation logic
  tree/affiliates/revenue-projector.ts          → projection math
  land/affiliates/creator-revenue-dashboard.ts  → business workflow

Feature D (Multi-Lang Expansion):
  seed/config/sops/playbooks/                   → foundational data
  (no code changes — data only)
```

## Import Rules
- All new files use canonical imports: `@/seed/*`, `@/tree/*`, `@/forest/*`, `@/land/*`
- No imports from `@/lib/*` (banned)
- No circular dependencies

## Reused Components
- Existing D1 client: `@/seed/db/client`
- Existing auth: `@/seed/auth/better-auth-session`
- Existing LLM: `@/land/llm/` (Feature B)
- Existing commission_ledger (Feature C)
- Existing i18n: `next-intl` (Feature D)

## Migration Plan
1. `0161_outcome_tracking.sql` — new tables only, no data migration
2. `0162_creator_revenue.sql` — new tables only
3. Feature flags: all features behind flags for gradual rollout

---
