# Complete Campaign Dashboard UI + Stitch Integration

> Tasks: #75 (Campaign Dashboard UI), #85 (Dashboard completion), #74 (Stitch integration)
> Date: 2026-06-21
> Status: In Progress

## Mission

Complete the Campaign Dashboard UI and Stitch integration by:
1. Creating `forest/dashboard` module for data orchestration (Sophia layer rules)
2. Integrating Stitch MCP screens with real data, i18n (VN/EN), and responsive design
3. Writing comprehensive tests
4. Verifying build, type-check, and deployment readiness

---

## Phases Overview

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Forest Dashboard Module | ⏳ | Create `src/forest/dashboard/` with data fetching, types, and exports |
| Phase 2: Stitch i18n & Responsive | ⏳ | Add Vietnamese translations, fix responsive layouts for Stitch screens |
| Phase 3: Integration | ⏳ | Replace mock data with real API calls from forest/dashboard |
| Phase 4: Tests | ⏳ | Write unit and integration tests for dashboard components |
| Verification | ⏳ | Build, type-check, lint, test, deploy verify |

---

## Phase 1: Forest Dashboard Module

**Location:** `src/forest/dashboard/`

**Purpose:** Infrastructure orchestrator that provides dashboard-specific data aggregations and metrics, following Sophia's 4-layer architecture (forest = infrastructure orchestrators).

**Files to create:**
- `types.ts` - Dashboard-related types (CampaignMetrics, DashboardStats, etc.)
- `metrics.ts` - Functions: `getCampaignMetrics(userId)`, `getRecentCampaigns(userId, limit)`, `getDashboardStats(userId)`
- `index.ts` - Barrel export

**Integration points:**
- Calls `seed/db/client` for D1 queries
- May call `land/campaigns` for business logic
- Returns data structures consumed by UI components

**Constraints:**
- Pure TypeScript (no React)
- Sync DB client (`createServerClient()`)
- Zero `:any` types
- Proper error handling with logger

---

## Phase 2: Stitch i18n & Responsive

**Scope:** Complete the Stitch screens integration (13 screens)

**i18n Tasks:**
- Add missing translation keys to `messages/en.json` and `messages/vi.json`
- Wrap all user-facing strings in `useTranslations()` hooks
- Follow existing Sophia i18n pattern (nested namespaces: `stitch.dashboard.metrics.revenue`, etc.)
- Ensure 100% i18n coverage for all 13 screens

**Responsive Tasks:**
- Audit Stitch screens for mobile/tablet layout issues
- Fix breakpoints using Tailwind responsive prefixes (sm, md, lg, xl)
- Ensure tables collapse/scroll on small screens
- Test at 375px, 768px, 1024px, 1280px widths

**Files to modify:**
- `messages/en.json`
- `messages/vi.json`
- All `src/components/stitch/screens/**/*.tsx` files

---

## Phase 3: Integration

**Objective:** Replace mock data with real data from `forest/dashboard`

**Tasks:**
1. Update Stitch `dashboard-page.tsx` to fetch real metrics using server actions or direct data fetching
2. Update campaigns page (`app/[locale]/dashboard/campaigns/page.tsx`) to use forest/dashboard metrics
3. Connect Stitch Dashboard metrics to actual campaign data:
   - Revenue → billing/transactions
   - Subscribers → subscriber count
   - Growth → usage metering
   - Commission → affiliate payouts
4. Add auth guards to protected Stitch routes (already have getCurrentUser in pages)
5. Wire up Stitch Checkout to NOWPayments IPN (if applicable)

**Server Actions (if needed):**
- Create `app/actions/dashboard-metrics.ts` using `forest/dashboard` functions
- Use in dashboard page with `await` (server component)

---

## Phase 4: Tests

**Coverage Targets:**
- forest/dashboard module: 100% (unit tests)
- Stitch UI components: 80%+ (unit tests)
- Dashboard pages: E2E coverage via Playwright

**Test Files:**
- `src/forest/dashboard/metrics.test.ts` - Test metrics functions with mocked DB
- `src/components/stitch/screens/dashboard/dashboard-page.test.tsx` - Test rendering with real data
- Update existing test files for modified components

**Test Standards:**
- Follow Sophia test patterns (see `docs/code-standards.md`)
- Use `@testing-library/react` for component tests
- Mock D1 responses with proper types
- 100% pass rate required

---

## Success Criteria

- ✅ `forest/dashboard` module created and exporting correctly
- ✅ All Stitch screens have i18n keys (VN/EN) with no hardcoded strings
- ✅ Responsive design verified on mobile (375px), tablet (768px), desktop (1024px+)
- ✅ Mock data replaced with real data from forest/dashboard in Stitch Dashboard screen
- ✅ Unit tests pass: `npm test` → 100%
- ✅ Type-check passes: `npm run type-check` → 0 errors
- ✅ Build passes: `npm run build` → 0 errors
- ✅ Lint passes: `npm run lint` (within warning limits)
- ✅ No `:any` types introduced (verified via grep)
- ✅ Deployment verified: `npm run deploy:full` + SHA match (if deploying)

---

## Architecture Compliance

**Layer Rules:**
- `forest/dashboard/` imports only from `seed/` and `tree/` (and may call `land/` for orchestration per cross-layer-orchestration.md)
- UI components remain in `components/stitch/` (shared library outside layer model)
- Routes in `app/` consume forest module via server actions or direct imports

**Canonical Imports:**
- Auth: `@/seed/auth/better-auth-session`
- DB: `@/seed/db/client`
- Tier: `@/seed/db/get-user-tier`

---

## Dependencies

- **Pre-requisite:** Stitch screens already exported (plan 261019-1800-stitch-export-to-code)
- **Blocking:** i18n keys for Stitch screens (will add in Phase 2)
- **Independent:** forest/dashboard module can be built without Stitch changes

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Responsive layout breaks existing UI | Medium | Test incrementally; use Tailwind responsive utilities |
| i18n keys missing in VN translation | Low | Validate with `npm run i18n:validate` |
| Forest module violates layer boundaries | High | Review imports against sophia-layer-architecture.md |
| Mock data replacement breaks tests | Medium | Update tests alongside integration |

---

## Next Steps

1. Create `forest/dashboard/types.ts` and `metrics.ts`
2. Add i18n keys to messages/*.json
3. Update Stitch dashboard page with real data
4. Write unit tests
5. Run verification suite
6. Create completion report in `reports/`
