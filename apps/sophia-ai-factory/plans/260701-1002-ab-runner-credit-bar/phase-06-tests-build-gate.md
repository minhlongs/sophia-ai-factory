---
title: "Phase 06 — Integration tests & build gate"
description: "Write unit/integration tests for both features, verify build + all tests pass"
status: pending
priority: P1
effort: 2.5h
phase: 6
---

## Context Links
- Test framework: Vitest (from `CLAUDE.md`)
- Test conventions: `docs/testing.md`
- Build: `npm run build` (0 TS errors)
- Test: `npm test` (844+ tests)
- CI gate: `npm run ci` (typecheck + lint + test + secrets + audit)
- Protected flows: Setup Wizard, Telegram Bot, Payment Flow

## Overview
Write tests for both features, verify zero regressions, and ensure build passes. This phase gates the entire plan.

## Key Insights
- AB module (`forest/ab/`) likely has existing tests — check before writing duplicates
- `campaign-orchestrator.ts` has a pure-function core — easy to unit test
- `billing-client.tsx` is a client component — test via React Testing Library or integration test
- `sidebar-quota-widget.tsx` is a client component — same approach
- `usage-summary/route.ts` is an API route — test via HTTP mock or handler unit test
- The `generateVariants` function already handles fallback — test both paths

## Test Matrix

### Feature 1: A/B Runner

| Test | Type | What it verifies | Priority |
|------|------|-----------------|----------|
| `generateVariants` with key | unit | LLM call returns valid variants | P1 |
| `generateVariants` without key | unit | Falls back to deterministic variants | P1 |
| `generateVariants` with LLM failure | unit | Falls back gracefully | P1 |
| `createExperiment` | unit/integration | Inserts row into ab_experiments | P1 |
| `createCampaign` with AB | integration | Campaign creates + experiment row exists | P1 |
| `createCampaign` without BYOK key | integration | Campaign still succeeds (no AB block) | P2 |
| `evaluateWinner` thresholds | unit | 2× CTR rule, min impressions, max window | P1 |
| Inngest `generateCampaign` w/ variantATitle | unit | Uses variantATitle for title | P2 |
| Inngest `generateCampaign` w/o variantATitle | unit | Uses topic (backwards compat) | P2 |
| Bundle publisher AB selection | unit | Correct variant caption selected | P2 |
| Cron winner-picker | integration | No regressions (existing tests) | P2 |

### Feature 2: Credit Bar

| Test | Type | What it verifies | Priority |
|------|------|-----------------|----------|
| `getCampaignLimit` for all tiers | unit | BASIC=10, PREMIUM=50, ENTERPRISE=999, MASTER=999 | P1 |
| `usage-summary` returns video count | integration | API returns real campaign count | P1 |
| `usage-summary` returns video limit | integration | API returns tier limit | P1 |
| `CreditBar` with video props | unit | Renders with video label | P2 |
| `CreditBar` with MCU props (regression) | unit | Still renders MCU label (default) | P2 |
| `SidebarQuotaWidget` video row | unit | Renders video count below MCU | P2 |
| `SidebarQuotaWidget` unlimited tier | unit | Shows infinity icon | P2 |
| `SidebarQuotaWidget` missing video data | unit | Renders without video row (backwards compat) | P2 |

### Regression Gate

| Test | What it verifies |
|------|-----------------|
| `npm test` full suite | All 844+ existing tests pass |
| `npm run build` | 0 TypeScript errors |
| `npm run lint` | 0 ESLint errors |
| Protected flows | Setup Wizard, Telegram Bot, Payment Flow untouched |

## Implementation Steps

### Step 1: Scout existing AB tests
```bash
find src/forest/ab -name "*.test.*" -o -name "*.spec.*"
```
List existing tests. If `winner-picker` and `variant-generator` already have tests, verify they pass first.

### Step 2: Write AB unit tests (if gaps found)
Create/extend test files:
- `src/forest/ab/__tests__/variant-generator.test.ts`
  - Test with BYOK key (mock `resilientChatCompletion`)
  - Test without BYOK key (fallback path)
  - Test with LLM failure (mock rejection)
  - Test schema validation edge cases
- `src/forest/ab/__tests__/experiment-store.test.ts` (if not existing)
  - Test `createExperiment` with valid input
  - Test `getExperiment` returns null for missing ID
- `src/forest/ab/__tests__/winner-picker.test.ts` (verify existing, add if missing)
  - Test 2× CTR rule with edge cases
  - Test MIN_IMPRESSIONS threshold
  - Test MAX_WINDOW_HOURS expiry

### Step 3: Write campaign-creation integration test
Create `src/app/actions/__tests__/create-campaign-ab.test.ts`:
```typescript
// Mock dependencies: getCurrentUser, createServerClient, getD1, inngest
// Test: createCampaign → ab_experiments row exists
// Test: createCampaign without BYOK → campaign still created (no AB)
// Test: createCampaign with DB failure in AB → campaign still created
```

### Step 4: Write billing API test
Create `src/app/api/billing/__tests__/usage-summary-video.test.ts`:
```typescript
// Mock: getCurrentUser, createServerClient (campaigns table count)
// Test: returns videoGenerations count
// Test: returns videoGenerations limit from tier
// Test: BASIC tier → limit = 10
```

### Step 5: Write CreditBar component test
Create `src/app/[locale]/dashboard/billing/__tests__/credit-bar-video.test.tsx`:
```typescript
// Test: CreditBar with metricLabelKey="videosThisMonth" renders "videos this month"
// Test: CreditBar without metricLabelKey renders "MCU this month" (regression)
// Test: Green bar at 40% usage
// Test: Yellow bar at 85% usage
// Test: Red bar at 100% usage
```

### Step 6: Write SidebarQuotaWidget video test
Create `src/forest/components/dashboard/__tests__/sidebar-quota-widget-video.test.tsx`:
```typescript
// Mock: fetchJson for /api/quota/status
// Test: renders video row when data.video exists
// Test: renders infinity icon when limit >= 999
// Test: renders progress bar for limited tier
// Test: hides video row when data.video undefined
```

### Step 7: Run full test suite
```bash
npm test                    # All tests
npm run type-check          # TS check
npm run lint                # ESLint
npm run build               # Production build
```

### Step 8: Fix failures
Iterate on any failing tests or type errors. Follow the debugger → tester loop from `primary-workflow.md`.

## Todo List
- [ ] Scout existing AB tests
- [ ] Write missing AB unit tests (variant-generator, experiment-store)
- [ ] Write campaign creation + AB integration test
- [ ] Write usage-summary video count API test
- [ ] Write CreditBar video label component test
- [ ] Write SidebarQuotaWidget video row test
- [ ] Run `npm test` — all tests pass
- [ ] Run `npm run build` — 0 TS errors
- [ ] Run `npm run lint` — 0 ESLint errors
- [ ] Run `npm run ci` — full gate passes
- [ ] Verify protected flows: setup wizard, telegram bot, payment flow

## Success Criteria
- All existing 844+ tests pass (0 regressions)
- New test coverage for both features
- `npm run build` exits 0 with 0 TS errors
- `npm run lint` exits 0
- `npm run ci` passes fully
- Manual smoke test: create campaign → check ab_experiments row → check billing page video count → check sidebar widget

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Test mock setup complex for D1 | Medium | Medium | Mock `getD1()` and `createServerClient()` at module level; use existing mock patterns from codebase |
| Campaign creation test slow (DB interaction) | Low | Low | Use in-memory D1 mock or Vitest module mocking |
| Sidebar widget test needs React Testing Library | Medium | Low | Existing test setup likely already configured; check existing widget tests |
| Existing AB tests broken by changes | Low | Medium | Phases 02-03 only ADD integration points; existing AB modules unchanged |

## Security Considerations
- Test mocks must not leak real credentials
- Test data must use fake userIds, campaignIds, API keys

## Next Steps
- After Phase 06 passes: commit and create PR
- Deploy verification per CF-direct doctrine (`npm run deploy:full`)
- Update changelog and roadmap (docs-manager agent)
