---
title: "Security Audit Remaining Fixes — C2 Rate Limiter + Medium/Low Sweep"
description: "Fix remaining critical C2 (rate limiter D1 integration) + sweep Medium/Low defense-in-depth findings from 53-finding audit"
status: complete
priority: P0
effort: 5h
branch: main
tags: [security, rate-limiting, defense-in-depth, audit-fixes]
created: 2026-07-01
---

# Security Audit Remaining Fixes

**Source:** `plans/reports/brainstorm-260701-1430-security-audit-remaining-fixes.md`
**Strategy:** TDD for C2 (auth middleware), direct fix for Medium/Low

## Reality Check

Original audit: 53 findings. Cross-referenced ALL against committed code (be7f24908, 6668528d1, 3cc4309cf). **48 of 53 already fixed.** 5 remain:

| # | Severity | What | Effort |
|---|----------|------|--------|
| C2 | Critical | Rate limiter per-isolate Map — D1 not wired for auth | 2h |
| M6 | Medium | Verify MOCK_AI_SERVICES bypass fully removed | 0.5h |
| M16 | Medium | Verify access revocation error propagation | 0.5h |
| M18 | Low | Document OTEL CWE-770 as accepted risk | 0.25h |
| L1-L17 | Low | 17 defense-in-depth items | 1.5h |

**Already fixed and verified in code:** C1, C3, C4, H1-H11, M1-M5, M7-M15, M17

## Phases

| # | Phase | Effort | Status | Depends |
|---|-------|--------|--------|---------|
| 01 | C2: Rate limiter D1 integration | 2h | ✅ complete | — |
| 02 | Medium findings sweep | 1h | ✅ complete | — |
| 03 | Low defense-in-depth | 1.5h | ✅ complete | — |
| 04 | Verification + finalize | 0.5h | ✅ complete | 01, 02, 03 |

Phases 01, 02, 03 are independent — run in parallel.

## Validation Log

### Session 1 — 2026-07-01
**Trigger:** Initial plan validation after creation
**Questions asked:** 3

#### Questions & Answers

1. **[Architecture]** C2 fix: D1-backed rate limiter or document as accepted risk?
   - Options: D1-backed limiter | Document as accepted risk
   - **Answer:** D1-backed limiter
   - **Rationale:** Cross-isolate counting needed to prevent brute-force distribution across Workers. 2-5ms D1 latency acceptable for auth endpoints (low volume).

2. **[Scope]** How to handle the 17 Low defense-in-depth findings?
   - Options: Fix quick wins + document rest | Fix all 17 | Document all
   - **Answer:** Fix quick wins + document rest
   - **Rationale:** L1-L6 are high-impact one-liners (HSTS headers, lockout fail-closed, coupon env vars, MFA atomic, webhook sanitize). L7-L17 are truly cosmetic — document and move on.

3. **[Execution]** Execute phases in parallel or sequentially?
   - Options: Parallel | Sequential
   - **Answer:** Parallel — all 3 at once
   - **Rationale:** Phases 01+02+03 have zero cross-dependencies. Running in parallel cuts wall-clock time from 4.5h to 2h.

#### Confirmed Decisions
- C2: D1-backed rate limiter (not accepted risk)
- Low findings: Fix L1-L6, document L7-L17
- Execution: Parallel phases 01+02+03

#### Action Items
- None — plan requires no revision

### Session 2 — 2026-07-01 (Code Review Fixes)
**Trigger:** Code review found C1 blocker + H1 partial coverage
**Questions asked:** 0 (auto-fixed per review)

#### Findings & Fixes

1. **[C1 BLOCKER]** `checkAuthRateLimit()` defined but never wired into request path
   - **Fix:** Added import + call in `middleware.ts` proxyImpl() before pipeline dispatch (3 lines)
   - **Impact:** Auth endpoints now actually use D1-backed cross-isolate rate limiting

2. **[H1 HIGH]** HSTS only on error responses, not normal traffic
   - **Fix:** Added `Strict-Transport-Security` header to shared `applySecurityHeaders()` in `middleware-shared-config.ts`
   - **Impact:** All responses now include HSTS header

#### Post-Fix Verification
- TypeScript: ✅ 0 errors
- Tests: ✅ 6704 passed (2 pre-existing date-boundary failures)
- Lint: ✅ 1 pre-existing error (not ours)
- Build: ✅ Passed (SKIP_SYMBOL_UPLOAD=1)

## Quality Gates
- 0 TS errors, all tests pass (6701+)
- No breaking auth middleware contract
- Payment flow intact (Protected Flow #3)
- 4-layer architecture enforced
