# Phase 01 — Fix Layer Boundary Violations + Barrel Exports

**Pillar:** A — Hard Boundary Enforcement
**Status:** completed
**Priority:** P1
**Wave:** 1 (parallel with 03, 05)

## Context Links
- Parent plan: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Layer rules: `.claude/rules/sophia-layer-architecture.md`
- Cross-layer rules: `.claude/rules/cross-layer-orchestration.md`

## Overview

18+ vi phạm layer boundary hiện tại. Sửa từng file theo migration path defined trong cross-layer-orchestration.md:
1. Module là pure data/util → move xuống seed
2. Module là orchestration → invert dependency
3. Module là cross-domain → extract sang shared location

## Violations to Fix

### tree→land (12 violations)
| File | Fix |
|------|-----|
| `src/tree/clients/nowpayments-client.ts:9` — imports verifyInboundWebhook from land | Move `verifyInboundWebhook` to `src/tree/webhooks/` or seed |
| `src/tree/llm/index.ts:4-7` — barrel re-exports from land | Inline re-exports; callers import directly from `@/land/openclaw/` |
| `src/tree/sop/webhook-hmac.ts:16` — imports sign/verify from land | Move webhook signature to `src/seed/security/` (primitive) |
| `src/tree/fulfillment/index.ts:7` — barrel re-export from land | Remove barrel; callers import from `@/land/fulfillment/` |
| `src/tree/alerts/webhook-notification-signature.ts:11` — imports from land | Same fix as webhook-hmac — move to seed |
| `src/tree/affiliates/index.ts:7` — barrel from land | Remove barrel; callers import from `@/land/affiliates/` |
| `src/tree/gateway/checkpoint-supabase-persistence.ts:8` — imports supabase admin from land | Move `createAdminClient` to `src/seed/db/` |
| `src/tree/gateway/adapters/youtube-channel-adapter.ts:17` — imports from land | Move OAuth types to `src/tree/types/` |
| `src/tree/gateway/adapters/tiktok-channel-adapter.ts:16` — imports from land | Move OAuth types to `src/tree/types/` |

### seed→tree/forest/land (17 violations — CRITICAL)
| File | Fix |
|------|-----|
| `src/seed/types/audit-log.ts:9` — imports from tree supabase-types | Move shared types to seed |
| `src/seed/config/channel-cooldown-rules.ts:13` — imports from forest | Move `ChannelProvider` type to seed |
| `src/seed/security/webhook-validator.ts:17` — imports webhook from land | Already in seed! Move webhook primitives here |
| `src/seed/auth/oauth-state-store.ts:11` — imports crypto from tree | Move token-crypto to seed |
| `src/seed/auth/enriched-jwt-entitlements.ts:6` — imports features from land | Invert: pass features as param |
| `src/seed/auth/enforce-tier-quota.ts:9-10` — re-exports from forest | Remove re-export; callers import from forest directly |
| `src/seed/utils/circuit-breaker.ts:18` — imports slack from land | Use callback injection instead of direct import |
| `src/seed/compliance/soc2-prep.ts:32-33` — imports from land feature-flags | Pass as dependency |
| `src/seed/components/dashboard/dashboard-error-boundary.tsx:5` — imports i18n from land | Move `localizedHref` to seed |
| `src/seed/ai/*` (7 files) — various imports from tree/forest/land | Each needs individual fix per migration rules |
| `src/seed/db/workflow-repository.ts:8` — imports supervisor from land | Move `WorkflowStep` type to seed |
| `src/seed/db/get-user-channels.ts:15` — imports from forest | Move `ChannelProvider` type to seed |
| `src/seed/templates/campaign-templates.ts:6` — re-exports from land | Remove barrel |

### land→forest (3 violations — FORBIDDEN)
| File | Fix |
|------|-----|
| `src/land/video/publishing/execute.ts:7` — imports OAuth refresher from forest | Invert: forest calls land via event |
| `src/land/alerts/quota-alert-service.ts:8` — already deprecated | Remove deprecated re-export |
| `src/land/cron/sop-scheduler.ts:12` — imports runSop from forest | Invert: forest schedules via Inngest |

## Barrel Export Standardization

Ensure every domain folder has `index.ts`:
- `src/seed/index.ts` ✅ exists
- `src/tree/index.ts` ✅ exists
- `src/forest/index.ts` ✅ exists
- `src/land/index.ts` ✅ exists
- Add: `src/tree/webhooks/index.ts`, `src/seed/security/index.ts`

## Implementation Steps

1. Fix seed→upper violations first (most critical — foundational layer drift)
2. Fix tree→land violations (barrel re-exports + actual imports)
3. Fix land→forest violations (invert dependency)
4. Add missing barrel exports
5. Run `npm run type-check` after each batch

## Success Criteria
- [ ] `grep -rn "from '@/land" src/tree/ | grep -v __tests__ | grep -v index.ts` → 0 results (except allowed barrels)
- [ ] `grep -rn "from '@/tree\|from '@/forest\|from '@/land" src/seed/ | grep -v __tests__` → 0 results
- [ ] `grep -rn "from '@/forest" src/land/ | grep -v __tests__` → 0 results
- [ ] `npm run build` → 0 TypeScript errors
- [ ] `npm test` → all pass
