# Sophia AI Factory — Standardization Audit Report

**Date:** 2026-05-18 03:30 PT
**Commit audited:** `0acb2883` (post Phase 04a)
**Scope:** 10-dimension audit vs Sophia conventions (4-layer arch, doctrine v1.28.1, code-standards.md, i18n Rule 8, hygiene)
**Verdict:** **78/100** — Production-shipped with material standardization debt. Triage-ready.

---

## Executive summary

Sophia is production-live + functionally healthy (4,457 tests pass, 0 lint errors, doctrine ceiling 87.5 / target 92-94 per active plan). Standardization audit surfaces **~30 P0-P1 items** worth fixing pre-handover — primarily **cross-layer import violations (architectural debt)** + **lowercase 'master' tier values** + **6 console.* in production**. Many "P0" findings are mechanical (rename / restructure), not redesigns. Estimated effort: **4-6h for P0 + P1 quick wins**, the rest defers to backlog.

---

## Dimension-by-dimension

### D1. 4-Layer Architecture (seed → tree → forest → land)
**Score 4/10** — 19 real cross-layer violations.

Rule: `seed → ANY allowed`, `tree → seed only`, `forest → seed+tree (+ may call land for orchestration)`, `land → seed+tree+forest`. Reverse never.

| Direction | Count | Examples | Severity |
|---|---:|---|---|
| `land → forest` | 5 | `land/affiliates/offer-sync-cron.ts → @/forest/inngest/client`; same in `land/payouts/{payout-batcher,pending-promoter-cron,reconciliation}`; `land/billing/usage-aggregator-query → @/forest/usage-metering/aggregator` | **P0** — Forbidden by doctrine. Circular-dependency risk. |
| `tree → forest` | 7 | `tree/handover/auto-handover.ts → @/forest/outbox/email-outbox`; `tree/telegram/*` → multiple `@/forest/*` | **P0** |
| `tree → land` | 1 | `tree/telegram/telegram-bot-campaign-fsm.ts → @/land/affiliates` | **P0** |
| `seed → tree` | 3 | `seed/security/api-key-validator-{db,crypto}.ts → @/tree/audit/crypto-utils` | **P0** |
| `seed → forest` | 3 | `seed/auth/enforce-tier-quota.ts → @/forest/quota/video-quota` (+ tests) | **P0** |
| `seed → forest` (comment only) | 1 | `seed/types/quota-provider.ts` JSDoc example | **P3** false-positive |

**Fix patterns (per `cross-layer-orchestration.md` migration guide):**
- `land → @/forest/inngest/client`: move inngest client to `seed/inngest/client.ts` (it's a thin wrapper — qualifies as primitive)
- `tree/handover → @/forest/email/*`: invert — handover dispatches via event, forest subscribes
- `seed → @/tree/audit/crypto-utils`: move `crypto-utils` to `seed/security/` (already crypto, fits seed)
- `seed/auth/enforce-tier-quota → @/forest/quota`: invert — quota check defined in seed, forest implements

### D2. Doctrine v1.28.1 No-Tech Compliance
**Score 9/10** — Clean on API surface, legacy field names remain.

- ✅ NO Polar API imports, NO `@polar` package in `package.json`
- ✅ Only 2 Polar mentions in code: one webhook-validation **doc URL** (not invocation), one CSP comment "polar.sh removed"
- ⚠️ **10+ files** still carry legacy data-shape fields: `polar_customer_id`, `polarCustomerId`, `lastPolarSync` — primarily in `land/billing/{usage-aggregator,dunning/*}` and `forest/components/license/*`. **P2 hygiene**: rename to provider-agnostic (`paymentCustomerId`) once D1 schema migration affords it.
- ⚠️ **7 stale POLAR_* CF Worker secrets** still wired (`POLAR_API_KEY`, `POLAR_API_URL`, `POLAR_PRODUCT_{STARTER,GROWTH,PREMIUM,MASTER}`, `POLAR_WEBHOOK_SECRET`) — verify zero code refs then `wrangler secret delete`. **P2**.

### D3. Code Standards (`docs/code-standards.md`)
**Score 7/10**

- ✅ Zero `:any` in production code (4 grep hits all comments / strings — false positives)
- ✅ Zod validation on all admin promo API inputs (Phase 03 verified)
- ✅ Server Actions for mutations (existing convention)
- ⚠️ **5 lowercase `'master'` tier values** in `forest/raas-*` + `forest/components/admin/licenses/*` — Sophia tier enum is UPPERCASE only. **P1** — bug surface: tier comparison `tier === 'master'` will never match real `'MASTER'`. Likely already broken in license-generator flow.
- ⚠️ **6 real `console.*` calls** in production (excluding logger internals + SDK examples + comments): `welcome-page-client.tsx`, `bundle-publisher.ts`, `caption-translator.ts (4x)`. Replace with `seed/utils/logger-utility`. **P2**.
- ⚠️ **14 files > 200 LOC soft guideline** (biggest: `lib/supabase/types.ts` 902 — generated, OK; next: `forest/inngest/functions/publish-execute.ts` 530, `dashboard/settings/customize/customize-page-client.tsx` 516). **P2 backlog** — split as touched.

### D4. i18n (Rule 8)
**Score 10/10**
- ✅ `npm run i18n:validate` → 0 missing, 1,097 unique keys
- ✅ vi.json ↔ en.json parity verified post Phase 04a (+19 keys)
- ⚠️ **1 orphan key** `admin.promoCodes.bulk.bulkButton` from Phase 04a (header still hardcodes literal) — **L1 cleanup** in Phase 04b.

### D5. Test Hygiene
**Score 9/10**
- ✅ 4,457 pass / 32 skipped / 0 fail
- ⚠️ **2 `vi.mock` nested calls** (future Vitest error): `land/billing/email/__tests__/receipt-email.test.ts`, `forest/quota/__tests__/storage-tracker.test.ts` — **P2**.
- ⚠️ **4 anonymous default exports** in `tests/load/k6-{soak,spike,steady,stress}.js` — **P3**.

### D6. Documentation Completeness
**Score 9/10** — all 7 required docs present.

| Doc | Lines | Notes |
|---|---:|---|
| `project-overview-pdr.md` | 94 | OK |
| `codebase-summary.md` | 357 | OK |
| `code-standards.md` | 535 | OK |
| `system-architecture.md` | 846 | Above docs.maxLoc=800 — consider splitting **P3** |
| `deployment-guide.md` | 385 | OK |
| `project-roadmap.md` | 136 | OK |
| `design-guidelines.md` | 84 | OK |

- ⚠️ `system-architecture.md` exceeds `docs.maxLoc=800` (846 lines) — split into `arch/{database,workers,layers,security}.md` **P3**.

### D7. CI/CD + Deploy Guards
**Score 10/10**
- ✅ Pre-push hook G1-G5 active (verified Phase 03 + 04a pushes)
- ✅ `scripts/deploy-with-sha.sh` refuses unpushed deploy (since 2026-05-15)
- ✅ GH Actions intentionally disabled (`.disabled` archive); CF-direct doctrine documented
- ✅ Deploy SHA match enforced via `/api/version`

### D8. Security Posture
**Score 7/10**
- ✅ `npm audit --audit-level=high` → 0 vulnerabilities (pre-push G5 passed)
- ⚠️ **GitHub Dependabot: 95 vulns** (57 high + 29 moderate + 9 low) per push warning. Gap between `npm audit` and Dependabot suggests transitive-dep paths missed by audit. **P1** — Phase 06 pen test will surface.
- ✅ Admin gates on all `/api/admin/*` routes (Phase 03 verified)
- ✅ Rate limiting on bulk-generate (5/admin/hr)
- ✅ Secretlint pre-push catches secrets in commits
- ⚠️ 7 stale `POLAR_*` CF secrets (D2 carryover)

### D9. Project Conventions (Canonical Imports)
**Score 10/10**
- ✅ 0 files import from banned paths: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`
- ✅ `@/seed/auth/better-auth-session`, `@/seed/db/get-user-tier`, `@/seed/db/client`, `@/config/tiers` are exclusively used

### D10. Hygiene & Repo Foundations
**Score 5/10** — significant gap for handover-grade repo.

- ⚠️ **23 TODO/FIXME** comments in production — **P2** backlog cleanup
- ❌ **Missing GitHub templates** (P2 for client-handover):
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `.github/ISSUE_TEMPLATE/bug.md`
  - `.github/ISSUE_TEMPLATE/feature.md`
  - `.github/CODEOWNERS`
- ❌ **Missing root files**:
  - `SECURITY.md` (vuln disclosure policy) — **P1** for SaaS
  - `LICENSE` — **P0** for handover (legal ambiguity)
- ✅ `CONTRIBUTING.md` + `README.md` present

---

## Severity-ranked action list

### P0 (architecture / legal — fix before handover)
1. **Cross-layer violations** — 19 imports to migrate. Estimated 2-3h. Break into 4 PRs:
   1. `land/* → @/forest/inngest/client` (5) — move inngest client to `seed/`
   2. `tree/handover → @/forest/email/*` (3) — invert via event
   3. `tree/telegram → @/forest/publishing/*` + `@/forest/inngest/client` (5) — invert
   4. `seed → @/tree/audit/crypto-utils` (3) — move `crypto-utils` to `seed/security/`
   5. `seed/auth → @/forest/quota` (3 incl tests) — invert quota check
2. **Add LICENSE** to repo root (likely MIT or proprietary; ask client). 5 min.

### P1 (correctness / security — fix this sprint)
3. **5 lowercase `'master'` tier comparisons** → uppercase. ~10 min mechanical replace + verify license flow tests.
4. **6 real `console.*`** → replace with `logger` from `seed/utils/logger-utility`. ~20 min.
5. **`SECURITY.md`** — vuln disclosure email/PGP. 15 min.
6. **GitHub Dependabot 57 high vulns** — Phase 06 pen test scope already covers. Logged.
7. **Phase 03 carryovers in known-issues.md** — Idempotency-Key, perf p95 (already logged for Phase 03b).

### P2 (hygiene — backlog)
8. **10+ legacy Polar field names** in code — rename in next D1 schema migration window.
9. **7 stale POLAR_* CF secrets** — `wrangler secret delete` after verifying no code refs.
10. **OPENNEXT_VERSION hardcoded 1.17.3** in `api/version/route.ts:33` (logged).
11. **`bulk-form-client.tsx` 249 LOC** (Phase 04b split).
12. **14 files > 200 LOC** — split as touched.
13. **2 `vi.mock` nested calls** — hoist to module top.
14. **23 TODO/FIXME** — triage + close.
15. **Missing PR/ISSUE/CODEOWNERS templates** — boilerplate.
16. **`system-architecture.md` 846 lines > maxLoc 800** — split.

### P3 (cosmetic)
17. **CSV cell-injection** in bulk-generate output (admin-only audience).
18. **4 k6 anonymous default exports**.
19. **`bulkButton` orphan i18n key** (Phase 04b cleanup).
20. **L2 `expiresAt` UTC vs VN local end-of-day** (Phase 04b polish).
21. **`seed/types/quota-provider.ts` JSDoc example mentions `@/forest`** — false-positive layer violation; clarify comment.

---

## Recommended Phase 02b — "Standardization sprint"

Insert as Phase 02b in active plan, parallel-safe with Phase 02 staging wait:

| Task | Effort | Priority | Files |
|---|---:|---|---|
| Add LICENSE + SECURITY.md | 30m | P0/P1 | 2 files |
| Fix 5 lowercase 'master' | 20m | P1 | 5 files |
| Replace 6 console.* with logger | 30m | P1 | 4 files |
| Migrate 5 `land→forest` imports | 60m | P0 | 5+1 files (move inngest client) |
| Migrate 5 `tree→forest` (telegram) | 60m | P0 | 5 files |
| Migrate 3 `tree→forest` (handover) | 45m | P0 | 3 files |
| Migrate 3 `seed→tree` (crypto-utils move) | 30m | P0 | 3+1 files |
| Migrate 2 `seed→forest` (quota invert) | 45m | P0 | 2+1 files |
| Add `.github/` templates + CODEOWNERS | 30m | P2 | 4 files |
| Verify build + lint + test green | 30m | P0 | n/a |
| **TOTAL** | **~6h** | | ~30 files |

After this sprint: score 78 → ~92 (matches plan target).

---

## Unresolved Questions

1. **License choice** — MIT? Proprietary? Custom? Client decision.
2. **Inngest client placement** — `seed/inngest/client.ts` cleanest, but inngest is forest's primary tool; team may prefer keeping in `forest/` and inverting the call sites instead.
3. **`crypto-utils` migration** — keep in `tree/audit/` and remove `seed → tree` callers (re-implement minimal hmac/timingSafeEqual in `seed/security/`), OR move whole module to `seed/security/`?
4. **Polar field name migration timing** — wait for D1 schema migration window, or migrate now in this sprint?
5. **Phase 04b vs standardization sprint priority** — both ~similar effort; client may prefer one over the other.
