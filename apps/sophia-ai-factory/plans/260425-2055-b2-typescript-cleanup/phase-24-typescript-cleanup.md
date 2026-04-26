# Phase 24: TypeScript Cleanup — Telegram Protected Flow Assessment

**Status:** 🔄 PLANNING (2026-04-26)  
**Estimated Duration:** 3-5 hours (conditional on test plan approval)  
**Scope:** 1 critical path + optional tier 4 candidates  
**Target:** 4 TS18046 errors (telegram) + optional carries  
**Expected Results:** Telegram fixed (4 → 0) OR deferred pending webhook QA

---

## Overview

Phase 24 addresses final visible TS18046 errors. Primary target is `webhooks/telegram/route.ts` — a **PROTECTED FLOW** requiring webhook integration testing before implementation. Secondary path includes optional tier 4 documentation and dead-code cleanup.

**Critical Decision Point:** Telegram test plan approval required. Until stakeholder confirms webhook QA readiness, Phase 24 will execute optional carries only.

---

## Critical Path: Tier 3 Protected Flow

### File: `src/webhooks/telegram/route.ts`

**Current State:**
- 4 TS18046 errors
- Type: Request-body HTTP boundary cast (webhook signature + bot integration)
- Scope: **PROTECTED FLOW** — Telegram bot webhook handler (@Sophia_Bbot)
- Related endpoints: POST `/webhooks/telegram` (receives IPN from Telegram Bot API)

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

## Optional Tier 4 Candidates (No TS18046 Reduction)

### Carry 1: Dead Code Investigation & Deprecation

**File:** `src/app/api/quota/overage-events/route.ts` L75  
**Issue:** Unused `GETStatus` export (Phase 12 identification)  
**Action:** Investigate if export is safe to remove or document reason to keep  
**Effort:** 30-60 minutes (code audit + git history trace)

**Decision Items:**
- Is `GETStatus` used by external services?
- Deprecation path or safe deletion?
- Update imports if removing

### Carry 2: Dormant Feature Audit

**File:** `src/lib/raas/raas-invoice-generator.ts` L130+  
**Issue:** Dormant Polar/Stripe lifecycle logic (flagged Phase 22)  
**Context:** Polar.sh rejected Sophia product; PayOS is backup for Vietnam  
**Action:** Document lifecycle decision (is this feature still needed?)  
**Effort:** 30-60 minutes (research + documentation)

**Decision Items:**
- Remove Polar conditional logic?
- Keep as documentation of past integration?
- Migration path to PayOS only?

### Carry 3: Sub-Variant 4 Documentation

**File:** `docs/code-standards.md`  
**Task:** Formalize DB-result cast pattern (Sub-Variant 4) from Phases 20-23  
**Effort:** 1-2 hours (pattern synthesis + examples)

**Documentation Scope:**
- Pattern name: "Sub-Variant 4: Database Result Cast"
- When to use: DB query result type casting (Supabase → D1 migration)
- Example: RawUsageEventRow interface pattern
- Related instances: 7 total across Phase 20-23
- Link to phase reports for reference

### Carry 4: Better Auth Migration — user_metadata Standardization

**Context:** Phase 23 fixed `user_metadata` access in `usage/summary/route.ts`  
**Task:** Audit other files for similar post-Better-Auth migration patterns  
**Scope:** ~6 files identified earlier with `user_metadata?.role` fallback  
**Effort:** 1-2 hours (grep + standardization across team)

**Decision Items:**
- Remove all `user_metadata` fallback checks (Better Auth doesn't expose this)?
- Or create compatible shim?
- Document final Better Auth user shape for team

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

**Optional Tier 4 (Non-Blocking):**
- [ ] Dead code audit completed
- [ ] Dormant feature decision documented
- [ ] Sub-Variant 4 pattern documented in code-standards.md
- [ ] user_metadata standardization decision made

---

## Phase 24 Decision Tree

**IF telegram test plan approved + webhook QA ready:**
- Execute Path A: Implement telegram protected flow
- Result: 4 TS18046 fixed → **320 → 316 remaining (99.4%)**
- Timeline: 3-4 hours implementation + integration test
- Proceed to Phase 25 (optional carries + final cleanup)

**IF telegram deferred or test plan delayed:**
- Execute Path B: Optional tier 4 carries (research + documentation)
- Result: **0 TS18046 reduction** (documentation focus)
- Timeline: 2-3 hours (audit + decision items)
- Defer telegram to Phase 25 with explicit test plan

---

## Related Links

- **Phase 23 Completion:** `phase-23-typescript-cleanup.md`
- **Tester Report Phase 23:** `plans/reports/tester-260426-1107-b2-phase23-sister-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Telegram Bot Config:** `apps/sophia-ai-factory/config/telegram-bot.ts`
- **Webhook Signature Validator:** `src/lib/webhooks/telegram-validator.ts` (if exists)

---

**Status:** AWAITING APPROVAL  
**Priority:** CRITICAL (final visible TS18046 stretch)  
**Timeline:** 2026-04-27+ (pending telegram test plan)  
**Blocker:** Webhook integration test strategy required
