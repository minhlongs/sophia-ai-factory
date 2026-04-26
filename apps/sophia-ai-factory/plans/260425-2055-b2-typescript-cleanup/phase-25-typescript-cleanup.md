# Phase 25: TypeScript Cleanup — TS18046 Final Stretch + M1/M2 Carries

**Status:** 🔄 PLANNING (2026-04-26)  
**Estimated Duration:** 4-6 hours (conditional on telegram test plan approval)  
**Scope:** 1 critical protected flow + 2 medium-priority carries  
**Target:** 4 TS18046 errors (telegram) + M1/M2 bug fixes + refactoring  
**Expected Results:** Telegram fixed (4 → 0) OR deferred pending webhook QA

---

## Overview

Phase 25 addresses final TS18046 errors + carries flagged during Phase 24 hygiene review. Primary target is `webhooks/telegram/route.ts` — a **PROTECTED FLOW** requiring webhook integration testing before implementation. Secondary path includes M1/M2 bug fixes and refactoring carries.

**Critical Decision Point:** Telegram test plan approval required. Until stakeholder confirms webhook QA readiness, Phase 25 will execute M1/M2 carries only.

---

## Critical Path: Tier 3 Protected Flow

### File: `src/webhooks/telegram/route.ts`

**Current State:**
- 4 TS18046 errors
- Type: Request-body HTTP boundary cast (webhook signature + bot integration)
- Scope: **PROTECTED FLOW** — Telegram bot webhook handler (@Sophia_Bbot)
- Related endpoints: POST `/webhooks/telegram` (receives IPN from Telegram Bot API)
- Phase history: Deferred from Phase 24 pending test plan (decision tree Path A blocked)

**Implementation Plan (Requires Test Strategy First):**
1. Define local interface `TelegramWebhookPayload` (bot message update shape)
2. Verify webhook signature validation logic (HMAC-SHA256 against telegram token)
3. Apply Sub-Variant 4 cast at HTTP boundary: `(await request.json()) as TelegramWebhookPayload`
4. Validate IPN idempotency guards (chat_id, message_id uniqueness)
5. Test with staging webhook endpoint
6. Verify bot still responds to /campaign, /status, /results commands

**Sister Pattern Reference:** Phase 16-17 defensive `.catch()` pattern (request-body variants)

**Approval Required:**
- [ ] Webhook test plan documented
- [ ] Staging environment telegram token configured
- [ ] QA verification steps defined
- [ ] Rollback procedure in place

---

## Medium-Priority Carries (Phase 24 Flags)

### M1: `/api/quota/status` Orphan Endpoint Bug

**File:** `src/components/quota/quota-usage-dashboard.tsx:100`  
**Issue:** Component calls non-existent `/api/quota/status` endpoint (404 bug, pre-existing)  
**Related File:** `src/app/api/quota/status/route.ts` (deleted or never created?)

**Investigation Steps:**
1. Verify endpoint doesn't exist in current codebase (grep `/api/quota`)
2. Check git history for deletion or creation (was this Phase 12 cleanup casualty?)
3. Analyze component's quota status dependency — is it actually used?

**Options:**
1. Inline quota status fetch into `/api/quota/overage-events` endpoint (reuse existing)
2. Create new `/api/quota/status/route.ts` with response shape contract
3. Remove call entirely if status not needed for dashboard

**Effort:** 2-3 hours (investigation + fix)  
**Priority:** M1 (medium, internal dashboard only, non-breaking)

### M2: DRY Refactor — Extract `isUserAdmin()` Helper

**Scope:** Consolidate admin role check across 6 sites  
**Files:**
1. `src/app/api/billing/dunning/[licenseNonce]/notify/route.ts`
2. `src/app/api/billing/dunning/[licenseNonce]/handle-status/route.ts`
3. `src/app/api/billing/dunning/[licenseNonce]/hook/route.ts`
4. `src/app/api/usage-export/route.ts` (2 sites)
5. `src/app/api/usage/summary/route.ts`

**Current Pattern:**
```typescript
// Duplicated across 6 sites:
if (user.role !== 'admin') {
  // or user_metadata?.role (pre-cleanup) 
  return new Response(..., { status: 403 })
}
```

**Action:** Create `src/lib/auth-helpers.ts`:
```typescript
export function isUserAdmin(user: User): boolean {
  return user.role === 'admin'
}
```

**Effort:** 1-2 hours (extract + test + consolidate)  
**Priority:** M2 (refactor, improves maintainability)

### M2 Doctrine Question: `User.role?: string` Tightening

**Context:** Better Auth User type has optional `role` field  
**Current Type:**
```typescript
interface User {
  role?: string // optional
  // ...
}
```

**Research Questions:**
1. Is runtime always guaranteed to populate `role` for authenticated users?
2. Does Better Auth expose a `role` field or is it custom schema extension?
3. Should unauthenticated flow be blocked before role check (yes, already is)?

**If Yes:** Change to `User.role: string` (non-optional)
- Removes 6 optional chaining operators (phase 24 cleanup already did this)
- Tightens type safety — no null guards needed
- May need to verify migration path

**If No:** Keep optional, add explicit null guards
- Keep defensive checks
- Document why optional

**Effort:** 30-60 minutes (research + decision document)  
**Priority:** M2 (type safety improvement, doctrine decision)

---

## Optional Tier 4: Sub-Variant 4 Documentation

**File:** `docs/code-standards.md`  
**Task:** Formalize DB-result cast pattern (Sub-Variant 4) from Phases 20-23  
**Effort:** 1-2 hours (pattern synthesis + examples)

**Documentation Scope:**
- Pattern name: "Sub-Variant 4: Database Result Cast"
- When to use: DB query result type casting (Supabase → D1 migration)
- Example: RawUsageEventRow interface pattern
- Related instances: 7 total across Phase 20-23
- Link to phase reports for reference

---

## Success Criteria

**Telegram Protected Flow (Conditional):**
- [ ] Test plan documented and approved
- [ ] Webhook signature validation verified
- [ ] IPN idempotency guards in place
- [ ] Staging test passes (bot responds to /campaign, /status, /results)
- [ ] Production webhook endpoint confirmed
- [ ] Code review: >= 9.5/10
- [ ] 1394/1394 tests passing

**M1/M2 Carries (Non-Blocking):**
- [ ] M1 bug fix: `/api/quota/status` endpoint created or deprecated
- [ ] M2 refactor: `isUserAdmin()` helper extracted + consolidated (6 files)
- [ ] M2 doctrine: `User.role` tightening decision documented
- [ ] Sub-Variant 4 documentation in code-standards.md (optional)

---

## Phase 25 Decision Tree

**IF telegram test plan approved + webhook QA ready:**
- Execute Path A: Implement telegram protected flow
- Also execute M1/M2 carries in parallel
- Result: 4 TS18046 fixed → **318 → 314 remaining (99.6%)**
- Timeline: 4-5 hours implementation + integration test
- Proceed to Phase 26 (optional carries + final cleanup)

**IF telegram deferred or test plan delayed:**
- Execute Path B: M1/M2 carries + optional Sub-Variant 4 documentation
- Result: **0 TS18046 reduction** (bug fixes + refactoring focus)
- Timeline: 2-3 hours (investigation + fixes)
- Defer telegram to Phase 26 with explicit test plan

---

## Related Links

- **Phase 24 Completion:** `phase-24-typescript-cleanup.md`
- **Phase 24 Tester Report:** `plans/reports/tester-260426-1124-phase24-b2-execution-summary.md`
- **Phase 24 Code Review:** `plans/reports/code-review-260426-1124-b2-phase24-hygiene-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Telegram Bot Config:** `apps/sophia-ai-factory/config/telegram-bot.ts`
- **Webhook Signature Validator:** `src/lib/webhooks/telegram-validator.ts` (if exists)

---

**Status:** AWAITING APPROVAL  
**Priority:** CRITICAL (final TS18046 stretch + quality carries)  
**Timeline:** 2026-04-27+ (pending telegram test plan)  
**Blocker:** Webhook integration test strategy required
