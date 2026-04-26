# Code Review — B2 Phase 14: Coupons Apply Route HTTP Boundary Cast

**Date:** 2026-04-26
**File:** `src/app/api/coupons/apply/route.ts`
**Pattern:** HTTP Boundary Type Cast (Anti-Corruption Layer) — instance #8 (first inbound request-body variant)
**Reviewer:** code-reviewer

## Score: 9.8/10

## Verdict: AUTO-APPROVE (>=9.5, 0 critical)

## Breakdown
- Critical: 0
- Major: 0
- Minor: 1

## Pattern Compliance
- `CouponApplyRequest` interface declared adjacent to handler (lines 10-14) — mirrors prior Response-side interfaces (RaasSync, HeyGen, Proposal, ApiKeysCreate, AuditLogs, Quota, Referral).
- Cast applied at HTTP boundary: `(await request.json()) as CouponApplyRequest` (line 44) — narrowest possible scope, single call site, identical idiom.
- Anti-corruption layer correctly placed: untrusted JSON → typed shape immediately, all downstream reads (`body.code`, `body.tier`, `body.project`) flow through narrowed type.
- First inbound (request-body) variant in the series — outbound `await res.json()` instances #1-7 used same pattern; Phase 14 establishes parity for inbound payloads.

## Type Correctness
- All three fields `code? / tier? / project?: string` correctly optional — clients may omit any/all (validated empty/missing handled by defensive defaults).
- Matches existing defensive runtime guards verbatim:
  - `(body.code || '').trim().toUpperCase()` — undefined → empty string → invalid lookup → 200 + `success:false` (graceful).
  - `(body.tier || 'BASIC').toUpperCase()` — undefined → 'BASIC' default tier.
  - `body.project || 'sophia'` — undefined → 'sophia' default project.
- No `:any` introduced. Zero TS18046 violations on this file. Reduction 35 → 32 confirmed (-3).
- Compiles under strict mode; no implicit-any leakage downstream.

## YAGNI / KISS / DRY
- Interface contains ONLY the 3 consumed fields. Skips speculative additions (e.g., `userId`, `quantity`, `currency`) — correct minimization.
- No runtime `typeof` guards added — defensive `||` defaults already cover undefined/null/empty cases. No double-validation.
- Single import-free interface (no zod schema, no class, no factory). Matches Phase 7-13 minimalism.
- DRY: existing logic untouched; cast replaces implicit `any` from `request.json()` without restructuring.

## Regression Risk
- Zero. Diff is purely additive (interface declaration + single `as` cast).
- Runtime behavior identical: `(await request.json())` still returns the same parsed object; `as` is a compile-time-only assertion.
- Fall-through paths (invalid code / wrong project / expired / unknown tier) all preserved with same response shapes.
- Try/catch swallow on line 84 unchanged — still catches `request.json()` parse failures, returns 500.

## Consistency Check
Matches Phase 7-13 baseline on:
- Interface naming convention (`{Domain}{Action}Request|Response`).
- Optional-fields style (`?: string`).
- Cast position (immediately at parse boundary).
- Guard placement (defensive defaults before use).
- Try/catch swallow on JSON parse failure.

Inbound-vs-outbound distinction: parsed identically. Pattern generalizes cleanly.

## Security
- No new attack surface. Cast does NOT bypass validation — all string ops (`trim`, `toUpperCase`, dictionary lookup `COUPONS[code]`) safe on arbitrary strings.
- `coupon.projects.includes(project)` operates on string equality — no injection vector.
- Pricing math (`Math.max(0, Math.floor(...))`) clamped — no negative price exploit.
- Note: zero auth on this route (public coupon validation) — pre-existing, out of scope.

## Minor (non-blocking)
- L84 `catch { ... }` swallows the underlying error without logging. Pre-existing behaviour, not introduced by this diff. Future polish: log via structured logger for ops visibility. Out of scope for B2 Phase 14.

## Positive Observations
- Interface kept private (not exported) — correct scoping for single-consumer route handler.
- File well under 200-line modularization threshold (90 lines) — no split needed.
- Self-contained route (no DB, no external API) — coupon dictionary inlined, validation deterministic.
- Cast pattern now covers BOTH request and response boundaries — establishes complete anti-corruption layer template for remaining 32 TS18046 sites.

## Sophia Standards Compliance
- Zero `:any` ✓
- No `console.log` ✓
- Tier enum uppercase enforcement preserved (`tier.toUpperCase()`) ✓
- No banned imports (`@/lib/auth`, `@/lib/subscription`, etc.) ✓
- File path matches kebab-case convention ✓

## Unresolved Questions
None.
