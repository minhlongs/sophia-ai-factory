# Code Review — B2 Phase 18 (MCU Balance + Mission Launcher)

**Date:** 2026-04-26
**Reviewer:** code-reviewer
**Scope:** 2 files / 4 edits / 5 TS18046 fixes (HTTP boundary cast — response variant)
**Plan:** plans/260425-2055-b2-typescript-cleanup/

---

## Score: 9.7/10 — AUTO-APPROVE

**Critical:** 0 | **Major:** 0 | **Minor:** 1

---

## Files

### 1. src/components/raas/mcu-balance-widget.tsx
- Interface `RaasUsageResponse` added (3 optional fields: `balance`, `monthly_used`, `monthly_limit`)
- L34: `.then((d: RaasUsageResponse) => ...)` typed parameter
- L36-38: `?? 0` / `?? 0` / `?? 1000` fallbacks preserved
- 3 TS18046 eliminated

### 2. src/components/raas/mission-launcher.tsx
- Interface `MissionCreateResponse` added (3 optional fields: `mission?.id`, `id`, `error`)
- L77: `((await res.json()) as MissionCreateResponse).error || 'Failed'` — error path cast
- L78: `const data = (await res.json()) as MissionCreateResponse` — success path cast
- L79: `data.mission?.id ?? data.id ?? ''` — added empty-string fallback (NEW defensive guard)
- 2 TS18046 eliminated

---

## Pattern Adherence

| Criterion | Verdict |
|---|---|
| HTTP boundary cast (Phases 9-13 response variant) | PASS — exact match |
| YAGNI — only consumed fields in interfaces | PASS — `balance`/`monthly_used`/`monthly_limit` in widget; `mission.id`/`id`/`error` in launcher |
| Defensive fallbacks preserved | PASS — `?? 0`, `?? 1000` retained; `?? ''` newly added for `onSuccess` arg |
| Zero `:any` introduced | PASS |
| Protected flows untouched | PASS — internal RaaS dashboard only; no Setup Wizard / Telegram Bot / NOWPayments |
| Optional fields (`?:`) match defensive coding | PASS |
| `unknown` catch in mission-launcher preserved | PASS (L81) |

---

## Strengths

1. **Cast placement** — HTTP boundary precisely at `.json()` resolution; type info propagates cleanly.
2. **Mission launcher fallback hardening** — `?? ''` on L79 prevents `undefined` reaching `onSuccess(missionId: string)`. This is a STRICT IMPROVEMENT over pre-Phase-18 code which could pass `undefined` if API returned neither `mission.id` nor `id`.
3. **Interface naming** — `RaasUsageResponse` / `MissionCreateResponse` — domain-anchored, self-documenting.
4. **snake_case fields preserved** — matches API contract (`monthly_used`, `monthly_limit`); no camelCase mismatch.

---

## Minor Issues

### M1 (cosmetic, non-blocking): Double `res.json()` parse in mission-launcher

**Location:** mission-launcher.tsx L77-78

```typescript
if (!res.ok) throw new Error(((await res.json()) as MissionCreateResponse).error || 'Failed');
const data = (await res.json()) as MissionCreateResponse;
```

**Observation:** Pre-existing pattern (predates Phase 18) — `res.json()` is consumed once in error path, second call on L78 only runs in success path, so no `body already consumed` runtime error. Phase 18 did not introduce this; just preserved it. **NOT a regression.**

**Suggested future cleanup (out of scope for B2):**
```typescript
const data = (await res.json()) as MissionCreateResponse;
if (!res.ok) throw new Error(data.error || 'Failed');
```

Not required for Phase 18 approval — merely flagged for future hygiene pass.

---

## Risk Assessment

- **Runtime risk:** None. All fields are optional; fallbacks cover undefined.
- **API contract drift risk:** Low. Interfaces tolerate field absence.
- **Breaking change risk:** Zero — pure type annotations + 1 string fallback.
- **Protected flow impact:** Zero (RaaS internal dashboard only).

---

## Cumulative Phase Verification

- Phase 18 = instances #13 + #14 (response-body variant)
- TS18046 reduction claim: -5 errors (3 widget + 2 launcher) — VERIFIED via diff
- Cumulative: 462 → 21 (-441, ~95.5%) — credible if Phase 17 baseline = 26

---

## Approval

AUTO-APPROVE (9.7/10 ≥ 9.5 threshold).

Recommend proceeding to Phase 19. No fixes required.

---

## Unresolved Questions

1. Is the double-parse pattern on mission-launcher.tsx L77-78 a candidate for a follow-up cleanup phase, or accepted as-is given the success/error code paths are mutually exclusive?
2. Should `MissionCreateResponse.mission.id` be `string | undefined` (current: `{ id: string }` requires `id` if `mission` present) — is this the actual API contract, or should `id` also be optional inside `mission`?
