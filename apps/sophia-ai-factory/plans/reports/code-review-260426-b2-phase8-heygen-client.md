# Code Review — B2 Phase 8: HeyGen Client HTTP Boundary Cast

**Date:** 2026-04-26
**File:** `src/lib/heygen/heygen-client.ts`
**Type:** Type-only (HTTP boundary anti-corruption)
**Score:** 9.7/10
**Critical Issues:** 0
**Auto-approval:** YES (≥9.5 AND 0 critical)

## Pattern Consistency
Matches Phase 6 precedent exactly (`metering-reconciler-license-validator.ts:7-11,41`):
local interface describes external wire shape, cast applied at `request()` call site.
Anti-corruption boundary cleanly separates `HeyGenVideoStatusResponse` (wire, optional
fields, nested error object) from `HeyGenVideoStatus` (domain, required `status`, flat `error: string`).

## Semantics Verification
- `status ?? 'pending'` is **correct fallback**. Original code returned `status: undefined`
  which violates the `HeyGenVideoStatus.status` literal union — was a latent type bug, not
  documented behavior. New behavior: missing/null status maps to `'pending'`, matching
  HeyGen's v2 contract where in-flight videos may omit status during initial polling window.
- `data.data?.error?.message` correctly unwraps optional nested error.
- Runtime semantics for happy path unchanged: when API returns valid status string, it
  passes through as-is; only the error-shape narrowing is new.

## Risk Assessment
- **Low:** if HeyGen returns out-of-union status (e.g. `'unknown'`), TypeScript cast does
  not catch — would silently coerce to that string at runtime, then downstream consumers
  comparing against `'completed' | 'processing' | ...` would miss it. Acceptable for v2
  endpoint which is documented to use only the four declared states.
- **Mitigation suggestion (optional, NOT blocking):** runtime guard
  `if (!['processing','completed','failed','pending'].includes(status as string)) status = 'pending'`
  would harden against API contract drift. YAGNI says skip until observed.

## Criteria Scorecard
| Criterion | Result |
|---|---|
| Pattern consistency w/ Phase 6 | PASS — identical structure |
| Wire vs domain separation | PASS — distinct types, narrow cast |
| Fallback semantics | PASS — `'pending'` is correct default |
| Hidden runtime risk | LOW — only on undocumented API drift |
| YAGNI/KISS/DRY | PASS — minimal diff, no over-engineering |
| Sophia Protected Flows | PASS — setup wizard / telegram bot / payment untouched |

## TS Error Reduction
55 → 51 (-4 TS18046). Localized to `getVideoStatus`. No new errors introduced.

## File Size & Standards
File: 195 lines (under 200-line modularization threshold). No `:any`, no `console.log`,
no `@ts-ignore`. Clean.

## Recommendation
**APPROVE & MERGE.** Pattern is now established (Phase 6 + Phase 8 = 2 instances) — worth
documenting in `docs/code-standards.md` as the canonical "HTTP boundary cast" idiom for
remaining TS18046 cleanup phases.

## Unresolved Questions
- Should `HeyGenVideoStatusResponse` move to a shared `src/lib/heygen/types.ts` if more
  endpoints get the same treatment? (Defer — single use site today, YAGNI.)
- Worth adding a runtime status validator? (Defer — no observed contract drift incidents.)
