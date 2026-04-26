# Phase 26: TypeScript Cleanup — Telegram Protected Flow + M2 Refinement

**Status:** 🔄 PLANNING (2026-04-26)  
**Estimated Duration:** 4-6 hours (conditional on telegram test plan approval)  
**Scope:** 1 critical protected flow + M2 unit tests + M2 variant enhancement  
**Target:** 4 TS18046 errors (telegram) + M1/M2/M3 quality refinements  
**Expected Results:** Telegram fixed (4 → 0) OR deferred pending webhook QA

---

## Overview

Phase 26 addresses final TS18046 errors (telegram) + refinements flagged during Phase 25 code review. Primary target is `webhooks/telegram/route.ts` — a **PROTECTED FLOW** requiring webhook integration testing before implementation. Secondary path includes M1/M2/M3 refinement tasks and unit test coverage.

**Critical Decision Point:** Telegram test plan approval required. Until stakeholder confirms webhook QA readiness, Phase 26 will execute M1/M2/M3 refinements only.

---

## Critical Path: Tier 3 Protected Flow

### File: `src/webhooks/telegram/route.ts`

**Current State:**
- 4 TS18046 errors
- Type: Request-body HTTP boundary cast (webhook signature + bot integration)
- Scope: **PROTECTED FLOW** — Telegram bot webhook handler (@Sophia_Bbot)
- Related endpoints: POST `/webhooks/telegram` (receives IPN from Telegram Bot API)
- Phase history: Deferred from Phase 25 pending test plan (decision tree Path B executed instead)

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

## M1/M2/M3 Refinements (Phase 25 Review Flags)

### M1: Add Unit Tests for `isUserAdmin()` Helper

**File to Create:** `src/lib/auth/__tests__/is-user-admin.test.ts`  
**Related Implementation:** `src/lib/auth/is-user-admin.ts` (Phase 25)

**Test Cases:**
1. Session user with admin role → returns true
2. DB user with admin role → returns true
3. User without admin role → returns false
4. Null/undefined user → returns false or throws (clarify behavior)

**Effort:** 1 hour (4 test cases + coverage)  
**Priority:** M1 (code quality, Phase 25 review flag)

### M2: Create `isUserAdminWithRole()` Variant

**File to Create:** `src/lib/auth/is-user-admin-with-role.ts`  
**Purpose:** Optimize admin + role lookup (avoid double DB fetch)

**Context:**
- `usage-export-post-handler.ts:49-50` currently calls `isUserAdmin()` then separately looks up `user.role`
- Semantic bug risk: `role` field misinterpreted as `tier` in some contexts
- Solution: Combine into single function returning `{ isAdmin: boolean, role: string }`

**Signature:**
```typescript
export async function isUserAdminWithRole(user: User): Promise<{ isAdmin: boolean; role: string }> {
  // Single DB lookup if needed, or combined inline check
  return {
    isAdmin: user.role === 'admin',
    role: user.role
  }
}
```

**Effort:** 1-2 hours (extraction + testing)  
**Priority:** M2 (bug prevention, Phase 25 review flag)

### M3: Tighten Doc Comments

**Files to Update:**
1. `src/lib/auth/is-user-admin.ts` L17-19
   - Clarify: DB lookup is **unconditional** on non-admin users (security-positive)
   - Document: When to use vs when to use `isUserAdminWithRole()`
2. `src/app/api/quota/status/route.ts` L7
   - Anchor comment to Phase 24 GETStatus deletion
   - Clarify: This endpoint replaces pre-existing broken logic

**Effort:** 30 minutes (doc improvement)  
**Priority:** M3 (maintainability, Phase 25 review flag)

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

**M1/M2/M3 Refinements (Non-Blocking):**
- [ ] M1: `is-user-admin.test.ts` created with 4+ test cases
- [ ] M2: `isUserAdminWithRole()` variant created + applied
- [ ] M3: Doc comments tightened in is-user-admin.ts and quota/status/route.ts
- [ ] All 1394/1394 tests passing
- [ ] Code review: >= 9.5/10

---

## Phase 26 Decision Tree

**IF telegram test plan approved + webhook QA ready:**
- Execute Path A: Implement telegram protected flow
- Also execute M1/M2/M3 refinements in parallel
- Result: 4 TS18046 fixed → **318 → 314 remaining (99.6%)**
- Timeline: 4-5 hours implementation + integration test
- Proceed to Phase 27 (optional final cleanup + dormant carries)

**IF telegram deferred or test plan delayed:**
- Execute Path B: M1/M2/M3 refinements only
- Result: **0 TS18046 reduction** (code quality improvements focus)
- Timeline: 2-3 hours (no additional TS fixes)
- Defer telegram to Phase 27 with explicit test plan

---

## Carries from Prior Phases

**Phase 24 Doctrine Question:**
- `User.role?: string` optional vs required — research needed
- Should non-optional constraint be added post-M2 refinement?

**Phase 22 Dormant Items:**
- Polar/Stripe lifecycle logic (product decision needed)

**Phase 20 Long-Tail Candidates:**
- 5 TS2339 in `heygen-client.ts` (deferred, low impact)

**Baseline Discrepancy:**
- 462 vs current 318 tracking (should resolve to 314 if Phase 26 Path A succeeds)

**Modularization Candidates:**
- audit-log-table.tsx >200 LOC (Phase 21+ carry)

**Type Safety Improvements:**
- Structured error responses (P1, Phase 21 carry)
- Subscription race window (P2)
- AuditLog camelCase mismatch (P3)

**Endpoint Consolidation:**
- Zod migration admin endpoints (Phase 20+ carry)

---

## Related Links

- **Phase 25 Completion:** `phase-25-typescript-cleanup.md`
- **Phase 25 Tester Report:** `plans/reports/tester-260426-1135-b2-phase25-orphan-helper.md`
- **Phase 24 Completion:** `phase-24-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Telegram Bot Config:** `apps/sophia-ai-factory/config/telegram-bot.ts`
- **Webhook Signature Validator:** `src/lib/webhooks/telegram-validator.ts` (if exists)

---

**Status:** AWAITING APPROVAL  
**Priority:** CRITICAL (final TS18046 stretch + code quality refinements)  
**Timeline:** 2026-04-27+ (pending telegram test plan)  
**Blocker:** Webhook integration test strategy required for Path A execution
