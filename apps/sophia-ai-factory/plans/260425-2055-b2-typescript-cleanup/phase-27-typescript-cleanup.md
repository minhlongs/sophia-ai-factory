# Phase 27: TypeScript Cleanup — Telegram Protected Flow Final Push

**Status:** 📋 PLANNING (2026-04-26)  
**Estimated Duration:** 3-4 hours (conditional on webhook test plan approval)  
**Scope:** 1 critical protected flow + minor doc refinements  
**Target:** 4 TS18046 errors (telegram) + Phase 26 review carries  
**Expected Results:** Telegram fixed (4 → 0) OR deferred pending webhook QA

---

## Overview

Phase 27 addresses the final 4 TS18046 errors in `webhooks/telegram/route.ts` — a **PROTECTED FLOW** requiring webhook integration testing before implementation. Secondary path includes Phase 26 review minor flags (Mi-1/Mi-2/Mi-3).

**Critical Decision Point:** Webhook integration test plan approval required. Until stakeholder confirms webhook QA readiness and staging environment is configured, Phase 27 will be blocked.

---

## Critical Path: Tier 3 Protected Flow

### File: `src/webhooks/telegram/route.ts`

**Current State:**
- 4 TS18046 errors
- Type: Request-body HTTP boundary cast (webhook signature + bot integration)
- Scope: **PROTECTED FLOW** — Telegram bot webhook handler (@Sophia_Bbot)
- Related endpoints: POST `/webhooks/telegram` (receives IPN from Telegram Bot API)
- Phase history: Deferred from Phase 26 pending webhook test plan (Phase 26 executed Path B instead)

**Implementation Plan (Requires Test Strategy First):**
1. Define local interface `TelegramWebhookPayload` (bot message update shape)
2. Verify webhook signature validation logic (HMAC-SHA256 against telegram token)
3. Apply Sub-Variant 4 cast at HTTP boundary: `(await request.json()) as TelegramWebhookPayload`
4. Validate IPN idempotency guards (chat_id, message_id uniqueness)
5. Test with staging webhook endpoint
6. Verify bot still responds to /campaign, /status, /results commands

**Sister Pattern Reference:** Phase 16-17 defensive `.catch()` pattern (request-body variants)

**Approval Required:**
- [ ] Webhook test plan documented (staging token, QA steps, rollback procedure)
- [ ] Staging environment telegram token configured
- [ ] Bot command verification documented
- [ ] Production webhook endpoint confirmed
- [ ] Rollback procedure in place

---

## Phase 26 Review Carries (Minor Flags)

### Mi-1: JSDoc Clarification (Session-Trust Asymmetry)

**File:** `src/lib/auth/is-user-admin.ts`  
**Context:** Fast-path trusts session for promotion, ignores demotion (security pattern)

**Effort:** 15 minutes (1-2 line doc update)  
**Priority:** Mi-1 (maintainability, Phase 26 review flag)  
**Status:** Deferred Phase 27 (non-blocking)

### Mi-2: Unit Test Assertion Refinement

**File:** `src/lib/auth/__tests__/is-user-admin.test.ts`  
**Context:** Direct `isUserAdminWithRole.dbRole` assertion in tests

**Effort:** 20 minutes (assertion clarity)  
**Priority:** Mi-2 (code clarity, Phase 26 review flag)  
**Status:** Deferred Phase 27 (non-blocking)

### Mi-3: Tier Behavior Change Comment

**File:** `src/app/api/usage/export/post-handler.ts` near L68  
**Context:** Document tier behavior change: session-synthesized 'admin' vs old DB-only

**Effort:** 10 minutes (one-line comment)  
**Priority:** Mi-3 (code clarity, Phase 26 review flag)  
**Status:** Deferred Phase 27 (non-blocking)

---

## Success Criteria

**Telegram Protected Flow (Conditional):**
- [ ] Test plan documented and approved
- [ ] Webhook signature validation verified
- [ ] IPN idempotency guards in place
- [ ] Staging test passes (bot responds to /campaign, /status, /results)
- [ ] Production webhook endpoint confirmed
- [ ] Code review: >= 9.5/10
- [ ] 1398/1398 tests passing (no regressions)

**Phase 26 Review Carries (Non-Blocking):**
- [ ] Mi-1: JSDoc clarify session-trust asymmetry
- [ ] Mi-2: Unit test assertion refinement
- [ ] Mi-3: Tier behavior change comment
- [ ] All 1398/1398 tests passing
- [ ] Code review: >= 9.5/10

---

## Phase 27 Decision Tree

**IF telegram test plan approved + webhook QA ready:**
- Execute Path A: Implement telegram protected flow + Phase 26 carries
- Result: 4 TS18046 fixed → **318 → 314 remaining (99.6%)**
- Timeline: 3-4 hours implementation + integration test
- Proceed to Phase 28 (optional final cleanup + dormant carries) or completion

**IF telegram deferred or test plan delayed:**
- Execute Path B: Phase 26 review carries only (minor doc updates)
- Result: **0 TS18046 reduction** (doc improvements only)
- Timeline: ~1 hour (3 minor flags)
- Defer telegram to Phase 28+ with explicit test plan

---

## Carries from Prior Phases (Still Pending)

**Phase 24 Doctrine Question:**
- `User.role?: string` optional vs required — research needed
- Should non-optional constraint be added post-M2 refinement?

**Phase 22 Dormant Items:**
- Polar/Stripe lifecycle logic (product decision needed)

**Phase 20 Long-Tail Candidates:**
- 5 TS2339 in `heygen-client.ts` (low impact)

**Modularization Candidates:**
- audit-log-table.tsx >200 LOC

**Type Safety Improvements:**
- Structured error responses (P1)
- Subscription race window (P2)
- AuditLog camelCase mismatch (P3)

**Endpoint Consolidation:**
- Zod migration admin endpoints

---

## Related Links

- **Phase 26 Completion:** `phase-26-typescript-cleanup.md`
- **Phase 26 Tester Report:** `plans/reports/tester-260426-1158-b2-phase26-helper-tests.md`
- **Phase 26 Code Review:** `plans/reports/code-review-260426-1158-b2-phase26-helper-tests.md`
- **Phase 25 Completion:** `phase-25-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Telegram Bot Config:** `apps/sophia-ai-factory/config/telegram-bot.ts`
- **Webhook Signature Validator:** `src/lib/webhooks/telegram-validator.ts` (if exists)

---

**Status:** AWAITING WEBHOOK TEST PLAN APPROVAL  
**Priority:** CRITICAL (final TS18046 stretch + protected flow validation)  
**Timeline:** 2026-04-27+ (pending telegram webhook integration test strategy)  
**Blocker:** Webhook integration test plan + staging environment setup required for Path A execution
