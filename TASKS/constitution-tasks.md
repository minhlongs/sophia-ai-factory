# TASKS

## T001 — Accept Constitution

**Priority:** P0  
**Status:** Open  
**Owner:** Founder + CTO  
**Depends on:** none

**Acceptance:**

- [ ] `GOAL.md`, `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `EVALUATION.md`, `BUSINESS_MODEL.md`, `MONEY_GRAPH.md`, and `FOUNDER_MANIFESTO.md` reviewed.
- [ ] ADRs reviewed.
- [ ] DELETE candidates approved before deletion.

## T002 — Archive or Refactor Conflicting Docs

**Priority:** P0  
**Status:** Open  
**Owner:** COO + CTO  
**Depends on:** T001

**Acceptance:**

- [ ] `.opc/goal.md` conflicts resolved.
- [ ] Historical docs mentioning Polar/PayPal/Vercel/GitHub Actions as current truth are marked archive or updated.
- [ ] Current docs point to CF-direct deploy and no-tech doctrine.

## T003 — Validate First Paying Customer Flow

**Priority:** P0  
**Status:** Open  
**Owner:** CSO + CTO  
**Depends on:** T001

**Acceptance:**

- [ ] Signup → BYOK setup → payment → tier activation → first video is tested with real provider where safe.
- [ ] Telegram `/campaign`, `/status`, `/results` still work.
- [ ] NOWPayments/PayOS IPN idempotency and signature checks pass.

## T004 — Delete Generated Artifacts Only After Approval

**Priority:** P1  
**Status:** Open  
**Owner:** CTO  
**Depends on:** T001

**Acceptance:**

- [ ] `.next/`, `.open-next/`, `coverage/`, `test-results/`, `.claude/worktrees*`, `.agents/`, `repomix-output.xml` reviewed against git status.
- [ ] Deletion has explicit approval.
- [ ] No source files or canonical docs are removed.

## T005 — Dependency Audit Triage

**Priority:** P1  
**Status:** Open  
**Owner:** CTO  
**Depends on:** T001

**Acceptance:**

- [ ] `npm audit --audit-level=high --omit=dev` findings triaged.
- [ ] High-risk transitive packages are patched, waived, or tracked.
- [ ] Breaking fixes are not applied blindly.

## T006 — Agent Factory Product Readiness

**Priority:** P1  
**Status:** Open  
**Owner:** CEO + CTO  
**Depends on:** T001

**Acceptance:**

- [ ] Agent tiers, roles, costs, logs, feedback, and prompt variants are documented.
- [ ] Agent memory/journal PII scrubbing is verified.
- [ ] Agent execution failures are observable.

## T007 — `src/lib/*` Compatibility Plan

**Priority:** P2  
**Status:** Open  
**Owner:** CTO  
**Depends on:** T001

**Acceptance:**

- [ ] Current `src/lib/*` usage mapped.
- [ ] New imports remain banned for auth/db/tier.
- [ ] Refactor path prioritized by risk, not aesthetics.
