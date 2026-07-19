# Sophia AI Factory — Current State Audit vs Mekong-CLI Standards

**Date:** 2026-05-12  
**Audit Scope:** Directory structure, SOP docs, CI/CD gates, layer patterns, violations  
**Context:** Read-only assessment. No edits made.

---

## 1. DIRECTORY TREE (Actual Layer Layout)

```
src/
├── seed/              (140 .ts files) — Primitives + auth base + config
│   ├── auth/          — better-auth-session, enriched-jwt, enforce-tier-quota
│   ├── config/        — tiers/ barrel export (canonical tier config)
│   ├── db/            — client.ts (sync, createServerClient), get-user-tier.ts
│   ├── ai/            — proposal-generator, proposal-quality-check, templates (2026-05-12 added)
│   ├── types/         — interfaces, enums
│   ├── utils/         — logger-utility, primitives
│   └── ...
├── tree/              (191 .ts files) — Domain-reusable modules
│   ├── byok/          — BYOK store logic
│   ├── handover/      — auto-handover, handover-templates
│   ├── telegram/      — telegram bot/commands
│   ├── audit/         — audit-logger
│   ├── credentials/   — credential management
│   └── ...
├── forest/            (237 .ts files) — Reusable infrastructure orchestrators
│   ├── inngest/       — job functions (publish-execute, dunning-handler, etc.)
│   ├── raas/          — RAAS gateway + audit + permissions
│   ├── usage-metering/ — usage aggregator + quota types
│   ├── quota/         — quota-enforcer, video-quota, quota-checker
│   ├── email/         — sender, templates, delivery
│   ├── middleware/    — auth, rate limiting
│   ├── components/    — shared React components
│   ├── outbox/        — outbox pattern
│   ├── publishing/    — publishing orchestration
│   └── ...
├── land/              (148 .ts files) — Business domain workflows
│   ├── billing/       — dunning state machine, email delivery, tracking
│   ├── payouts/       — ledger, reconciliation, batcher, pending-promoter-cron
│   ├── affiliates/    — offer-sync-cron
│   ├── promo/         — promo logic
│   ├── refunds/       — refund workflows
│   ├── orders/        — order management
│   ├── account/       — account workflows
│   ├── wallet/        — wallet logic
│   ├── payments/      — payment coordination
│   ├── status/        — status/health checks
│   ├── checkout/      — checkout flow
│   ├── analytics/     — analytics aggregation
│   ├── observability/ — logging/tracing
│   └── ...
├── app/               — Next.js App Router (pages, API routes, layout)
├── lib/               — LEGACY "lib/" layer (deprecated, gradually migrating to seed)
│   ├── supabase/      — OAuth callbacks, admin invite (exceptions kept)
│   ├── llm/           — LLM adapters (Anthropic, OpenRouter)
│   ├── workflows/     — workflow computation
│   ├── signals/       — event bus
│   ├── ai/            — AI coordination logic
│   └── ... (misc utilities still in flux)
├── components/        — React components (some should migrate to forest/components)
├── utils/             — Utility functions (some duplicated with seed/utils)
├── db/                — Raw DB schema defs (consider consolidating into seed/db)
├── data/              — Data constants/fixtures
├── sdk/               — Public SDK exports
└── __tests__/, test/  — Test files
```

**Issues Noted:**
- `lib/` layer persists (legacy from pre-consolidation) — should be fully deprecated
- `components/`, `utils/`, `db/` at root level (not organized into layers) — candidates for layer migration
- No conflict; structure nominally follows 4-layer convention

---

## 2. SOP DOCS GAP MATRIX

| Mekong SOP | File(s) | Sophia Equivalent | Gap | Status |
|---|---|---|---|---|
| **dev-sops.md** | `docs/dev-sop-*.md` (multiple) | Partial: `code-standards.md`, `contributor-handover.md`, `CONTRIBUTING.md` | **PARTIAL** — docs scattered, no single SOP index | 🟡 |
| **README.md** | `README.md` (root of app) | ✅ Exists | Present | ✅ |
| **CONTRIBUTING.md** | `CONTRIBUTING.md` | ✅ Exists | Present | ✅ |
| **system-architecture.md** | `docs/system-architecture.md` | ✅ Exists | 801 lines, comprehensive | ✅ |
| **code-standards.md** | `docs/code-standards.md` | ✅ Exists | 469 lines + `code-standards-advanced-patterns.md` | ✅ |
| **deployment-guide.md** | `docs/deployment-guide.md` | ✅ Exists | 290 lines, CF-direct focused | ✅ |
| **project-roadmap.md** | `docs/project-roadmap.md` | ✅ Exists | Updated 2026-05-12 | ✅ |
| **project-changelog.md** | `docs/project-changelog.md` | ✅ Exists | 519 lines, detailed | ✅ |

**Gaps:**
1. **No unified `dev-sops.md`** — SOP content split across multiple files:
   - `sop-ceo-production-smoke.md` (CEO smoke test)
   - `sophia-supervisor-agent-runbook.md` (agent operations)
   - `payout-operations-runbook.md` (payout SOP)
   - `load-testing-runbook.md` (perf SOP)
   - No index/TOC linking them

2. **No `dev-sops.md` template structure** — Mekong has 1 canonical SOP file; Sophia spreads across domain SOPs

3. **No "git workflow" SOP** — no doc for branching, commit conventions, PR review process (though `CONTRIBUTING.md` basic)

---

## 3. CI/CD GATES GAP MATRIX

| Mekong Gate | Tool/Command | Sophia Has? | Location | Gap | Status |
|---|---|---|---|---|---|
| **Lint** | ESLint | ✅ Yes | `npm run lint` | Present | ✅ |
| **Type check** | TypeScript `tsc` | ✅ Yes | `npm run type-check` | Present | ✅ |
| **Unit tests** | Vitest | ✅ Yes | `npm test` | 1398+ tests | ✅ |
| **Build** | Next.js + wrangler | ✅ Yes | `npm run build` | CF-direct via wrangler | ✅ |
| **Security scan** | npm audit + (no Snyk) | ⚠️ Partial | `package.json` has audit script | No automated Snyk in GHA | 🟡 |
| **Pre-commit hook** | husky/lefthook | ❌ No | N/A | Missing pre-commit guard | ❌ |
| **Pre-push hook** | N/A | ❌ No | N/A | No pre-push linting/testing | ❌ |
| **CI/CD pipeline** | GitHub Actions | ⚠️ INTENTIONAL | `.github/workflows/test.yml` + `.github/workflows/test.yml.disabled` | Actions DISABLED by design (2026-05-03) — CF-direct is canonical | 🟡 |
| **Deployment** | wrangler CLI | ✅ Yes | `npm run deploy:full` + `scripts/deploy-with-sha.sh` | SHA injection, CF-direct | ✅ |
| **Migration application** | Custom script | ✅ Yes | `npm run deploy:migrations` + `scripts/apply-migrations.sh` | D1 migration runner | ✅ |

**Critical Notes:**
- GitHub Actions `.disabled` is **INTENTIONAL** (account limitations 2026-05-03). CF-direct doctrine adopted as permanent. NOT a bug.
- `test.yml.disabled` remains for future re-enable if needed (documented in CLAUDE.md)
- **MISSING:** Pre-commit/pre-push hooks (developers rely on local discipline)
- **MISSING:** Automated security scanning (npm audit exists but not gated)

**Sophia-Specific Gates (CF-direct doctrine):**
```
Gate 1: npm run build       → 0 TS errors (via next build)
Gate 2: npm test            → 1398+/1398 tests pass
Gate 3: npm run deploy:full → wrangler deploy with SHA injection
Gate 4: verify.sh           → /api/version SHA match (live vs local)
```

---

## 4. PEV (Planner/Executor/Verifier) Pattern Check

**Search Results:**

```bash
# grep -r "class.*Agent" src/seed/ai/ 
→ src/seed/ai/proposal-generator.ts:6:  abstract class for proposal generation (not PEV pattern)

# grep -rn "plan(\|execute(\|verify(" src/seed/ai/ 
→ 0 results (no PEV terminology)

# PEV pattern observed in forest/inngest/:
src/forest/inngest/functions/publish-execute.ts:530: "execute" method (broad orchestration)
src/forest/inngest/functions/__tests__/publish-execute-video-url-wave17.test.ts: nested step execution
```

**Finding:** 
- **PEV pattern NOT present** in sophia (Mekong imports PEV from `ai-agents` npm package)
- Sophia has **custom orchestration** via Inngest (job scheduling) + domain logic
- Recent addition: `seed/ai/proposal-generator.ts` (2026-05-12) is template-based, not PEV-structured
- **Assessment:** Next.js handlers + Inngest jobs are sophia's equivalent to orchestration; not a 1:1 port of mekong's PEV

**Verdict:** Not a gap — Sophia has different orchestration paradigm (event-driven vs agent-based)

---

## 5. LAYER BOUNDARY VIOLATIONS

### **CRITICAL VIOLATION: seed → forest imports (Found 5 instances)**

```
src/seed/auth/enriched-jwt-types.ts:7:
  import type { QuotaLimit } from '@/forest/usage-metering/types'

src/seed/auth/enriched-jwt.ts:18:
  import { getEffectiveQuotaLimits } from '@/forest/quota/quota-checker'

src/seed/auth/enriched-jwt.ts:20:
  import type { QuotaLimit } from '@/forest/usage-metering/types'

src/seed/auth/better-auth-server.ts:13:
  import { sendEmail } from '@/forest/email/sender'

src/seed/auth/enforce-tier-quota.test.ts:22:
  import { checkVideoQuota } from '@/forest/quota/video-quota'
```

**Issue:** Seed layer importing from forest violates layer hierarchy. Seed should be foundational (NO dependencies on upper layers).

**Impact:** Mid-high. Creates circular reasoning:
- `seed/auth` → `forest/quota` (seed depends on orchestration)
- If `forest` later needs `seed/auth`, circular dependency forms

**Root Cause:** Tier enforcement logic mixed in `seed/auth` but needs quota data from `forest`

**Fix Strategy:**
1. Extract quota-dependent logic from `seed/auth` → new module in `tree` or `forest`
2. Keep `seed/auth` pure: only session/JWT, no quota logic
3. Move quota checks to `forest/middleware/enforce-tier-quota` or similar

---

### **ALLOWED: land → forest imports (Orchestration exception)**

```
src/land/affiliates/offer-sync-cron.ts:11:
  import { inngest } from '@/forest/inngest/client'

src/land/payouts/payout-batcher.ts:14:
  import { inngest } from '@/forest/inngest/client'

src/land/payouts/pending-promoter-cron.ts:11:
  import { inngest } from '@/forest/inngest/client'

src/land/payouts/reconciliation.ts:11:
  import { inngest } from '@/forest/inngest/client'

src/land/billing/usage-aggregator-query.ts:10:
  import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator'
```

**Status:** ✅ **ALLOWED** (per `cross-layer-orchestration.md`)
- Land business workflows call forest orchestrators (Inngest jobs)
- Documented exception for forest→land pattern
- No violations detected

---

### **OVERSIZED FILES (>200 LOC)**

**Top 20 files exceeding 200-line limit:**

| File | LOC | Type | Concern |
|---|---:|---|---|
| `src/lib/supabase/types.ts` | 902 | Type defs | Should split by domain |
| `src/forest/inngest/functions/publish-execute.ts` | 530 | Orchestration | Complex, but justified (orchestrator) |
| `src/app/api/cron/workflow-stepper/route.test.ts` | 532 | Test | Large test file OK |
| `src/forest/inngest/functions/__tests__/publish-execute-video-url-wave17.test.ts` | 432 | Test | Large test OK |
| `src/lib/llm/cache/llm-cache.test.ts` | 522 | Test | Large test OK |
| `src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx` | 516 | UI | Consider component split |
| `src/lib/ai/anthropic-adapter.test.ts` | 511 | Test | Large test OK |
| `src/app/[locale]/setup-wizard/page.tsx` | 503 | UI | Consider split into steps |
| `src/seed/auth/enriched-jwt.test.ts` | 475 | Test | Large test OK |
| `src/app/[locale]/dashboard/layout.tsx` | 461 | Layout | Consider modularization |

**Assessment:**
- **Tests >200 LOC:** ACCEPTABLE (testing large surfaces requires long test cases)
- **UI files >200 LOC:** CAUTION (should split complex pages into components)
- **Type definitions >200 LOC:** CANDIDATE for splitting (e.g., `lib/supabase/types.ts` → 902 LOC is extreme)

---

## 6. BANNED IMPORTS CHECK

```bash
grep -r "@/lib/auth\|@/lib/subscription\|@/lib/unified-tier-config\|@/lib/tier-gate" src/
→ 0 results ✅

# (These were deleted during 2026-04-14 consolidation)
```

**Status:** ✅ **CLEAN** — No banned imports detected

---

## 7. TOP 5 ACTIONABLE FINDINGS (Ranked by Leverage/Risk)

### 🔴 **FINDING #1: seed → forest circular risk [HIGH LEVERAGE]**

**Status:** Violation detected (5 imports)  
**Files:** `src/seed/auth/{enriched-jwt,better-auth-server,enforce-tier-quota}`  
**Risk:** Medium  
**Leverage:** High (foundational layer)

**Action:**
- [ ] Extract tier/quota enforcement from `seed/auth` → move to `forest/middleware/tier-quota-enforcer`
- [ ] Keep `seed/auth` pure: session/JWT only
- [ ] Update imports in `app/` route handlers

**Effort:** 2–3 hours

---

### 🟡 **FINDING #2: Missing pre-commit/pre-push hooks [MEDIUM LEVERAGE]**

**Status:** Gap  
**Impact:** Developers rely on discipline; CI/CD doesn't gate locally  
**Current:** No husky/.pre-commit-config  
**Risk:** Low (CF-direct deploy provides final gate)

**Action:**
- [ ] Add `.husky/` with `npm run lint && npm run type-check`
- [ ] Add `npm run test` to pre-push (or skip if slow)
- [ ] Document in `CONTRIBUTING.md`

**Effort:** 1 hour

---

### 🟡 **FINDING #3: Scattered SOP docs [MEDIUM LEVERAGE]**

**Status:** Gap  
**Files:** 5+ SOP files with no index  
**Risk:** Low (docs exist, just unorganized)

**Action:**
- [ ] Create `docs/dev-sops.md` (TOC/index)
- [ ] Link: CEO smoke, agent runbooks, payout ops, load testing
- [ ] Add git workflow SOP (branching/PR process)

**Effort:** 1–2 hours

---

### 🟡 **FINDING #4: `lib/supabase/types.ts` oversized [LOW LEVERAGE]**

**Status:** Type definitions (902 LOC)  
**Risk:** Context sprawl in IDE/LSP  
**Impact:** Maintenance minor

**Action:**
- [ ] Split by domain: `seed/types/oauth-*.ts`, `seed/types/db-*.ts`
- [ ] Keep `lib/supabase/types.ts` as barrel export

**Effort:** 1–2 hours (refactor-only, no logic change)

---

### 🟢 **FINDING #5: GitHub Actions `.disabled` is intentional [DOCUMENTATION VERIFIED]**

**Status:** Not a bug  
**Documented in:** `CLAUDE.md`, `.github/workflows/test.yml.disabled`  
**Reason:** Account limitations 2026-05-03; CF-direct adopted as canonical

**Action:**
- [ ] No change required
- [ ] If Actions restored: rename `.yml.disabled` → `.yml` + verify triggers

**Status:** ✅ Intentional design

---

## SUMMARY SCORECARD

| Dimension | Score | Status |
|---|---:|---|
| **Layer structure** | 8/10 | Named 4-layer correct; boundary violations in seed layer |
| **SOP documentation** | 7/10 | Docs exist but scattered; no unified index |
| **CI/CD gates** | 9/10 | Complete (sans pre-commit hooks). CF-direct intentional. |
| **Code modularization** | 8/10 | Most files <200 LOC; types.ts outlier |
| **Banned imports** | 10/10 | Clean; 2026-04-14 consolidation successful |
| **Layer imports** | 7/10 | Allowed (land→forest) OK; seed→forest violation ⚠️ |

**Overall:** **78/100 — Production Grade with Curable Gaps**

---

## UNRESOLVED QUESTIONS

1. **Quota enforcement location:** Should `seed/auth/enforce-tier-quota.ts` move to `forest/middleware` or `tree/tier-enforcement`? (Architectural decision pending)
2. **Type definitions sprawl:** Is `lib/supabase/types.ts` 902 LOC intentional (legacy from Supabase SDK), or should it be split into `seed/types/oauth-*` + `seed/types/database-*`?
3. **Pre-commit enforcement:** Given CF-direct deploy, is pre-commit/pre-push hook needed, or is live verification via `/api/version` sufficient for quality gate?
4. **`@/lib` deprecation timeline:** Remaining `lib/` modules (LLM adapters, workflows, signals) — migrate to layer organization or keep as-is?

---

**Report Generated:** 2026-05-12 20:01 UTC  
**Audit Scope:** Read-only (no code changes)  
**Next:** Coordinate with lead on remediation priority.
