# TASKS

## T001 — Accept Constitution

**Priority:** P0
**Status:** ✅ Complete (2026-08-21)
**Owner:** Founder + CTO
**Depends on:** none

**Acceptance:**

- [x] `GOAL.md`, `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, and `FOUNDER_MANIFESTO.md` reviewed.
- [x] ADRs reviewed (ADR 0007 accepted — deprecate video_jobs Inngest chain).
- [x] DELETE candidates approved before deletion (`.opc/goal.md` archived → `docs/archive/opc-goal-conflicting.md`).

**Evidence:** `.sophia-factory/journal/20260821-constitution-acceptance-t001.md`

## T002 — Archive or Refactor Conflicting Docs

**Priority:** P0
**Status:** ✅ Complete (2026-08-21)
**Owner:** COO + CTO
**Depends on:** T001

**Acceptance:**

- [x] `.opc/goal.md` conflicts resolved — archived to `docs/archive/opc-goal-conflicting.md`.
- [x] Historical docs mentioning Polar/PayPal/Vercel/GitHub Actions as current truth are marked archive or updated.
- [x] Current docs point to CF-direct deploy and no-tech doctrine.

**Evidence:** `.sophia-factory/journal/20260821-constitution-acceptance-t001.md`, `CATEGORIZATION.md` updated

## T003 — Validate First Paying Customer Flow

**Priority:** P0
**Status:** ✅ Complete (2026-08-21) — P0 blocker resolved
**Owner:** CSO + CTO
**Depends on:** T001

**Acceptance:**

- [x] Signup → BYOK setup → payment → tier activation → first video is tested with real provider where safe.
- [x] Telegram `/campaign`, `/status`, `/results` still work.
- [x] NOWPayments/PayOS IPN idempotency and signature checks pass.

**Key deliverable:** Created `src/app/[locale]/payment-success/page.tsx` (P0 blocker — 9 redirect sources pointed to missing route). Two review rounds completed. All 7112 tests passing.

**Evidence:** `plans/reports/t003-payment-flow-validation.md`, `.sophia-factory/journal/20260821-payment-success-p0-fix.md`, `.sophia-factory/journal/20260821-payment-success-review-round2.md`

## T004 — Delete Generated Artifacts Only After Approval

**Priority:** P1
**Status:** ✅ Complete (2026-08-21)
**Owner:** CTO
**Depends on:** T001

**Acceptance:**

- [x] `.next/`, `.open-next/`, `coverage/`, `test-results/`, `.claude/worktrees*` reviewed and deleted (regenerable, zero risk).
- [x] `.agents/` deliberately NOT deleted — flagged as HIGH risk until T006 audit confirms safety.
- [x] `repomix-output.xml` deleted.
- [x] No source files or canonical docs are removed.

**Note:** `.agents/` requires T006 completion before deletion decision. T006 report recommends preserving until platform agent routing is proven.

## T005 — Dependency Audit Triage

**Priority:** P1
**Status:** ✅ Complete (2026-08-21)
**Owner:** CTO
**Depends on:** T001

**Acceptance:**

- [x] `npm audit --audit-level=high --omit=dev` findings triaged.
- [x] High-risk transitive packages are patched, waived, or tracked.
- [x] Breaking fixes are not applied blindly.

**Evidence:** `plans/reports/t005-dependency-audit.md`

## T006 — Agent Factory Product Readiness

**Priority:** P1
**Status:** ✅ Complete (2026-08-21)
**Owner:** CEO + CTO
**Depends on:** T001

**Acceptance:**

- [x] Agent tiers, roles, costs, logs, feedback, and prompt variants are documented.
- [x] Agent memory/journal PII scrubbing is verified.
- [x] Agent execution failures are observable.

**Evidence:** `plans/reports/t006-agent-factory-review.md`

## T007 — `src/lib/*` Compatibility Plan

**Priority:** P2
**Status:** ✅ Complete (2026-08-21)
**Owner:** CTO
**Depends on:** T001

**Acceptance:**

- [x] Current `src/lib/*` usage mapped.
- [x] New imports remain banned for auth/db/tier.
- [x] Refactor path prioritized by risk, not aesthetics.

**Evidence:** `plans/reports/t007-src-lib-refactor-plan.md`
