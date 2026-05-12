# Code Review — Welcome Page i18n Refactor

**Report ID:** code-reviewer-260512-0633-welcome-i18n-refactor
**Date:** 2026-05-12 06:33 UTC
**Scope:** ~24 `isVi` ternaries → `useTranslations('welcome')`
**Files:** page.tsx, welcome-page-client.tsx, welcome-onboarding-steps.tsx, messages/{vi,en}.json
**Tester:** ✅ 1931 tests pass, 0 missing keys, 0 TS errors, no isVi residue
**Verdict:** **APPROVE-WITH-FIXES** (≥9.0, 0 critical)
**Score:** **9.2 / 10**

---

## Verdict Rationale

Refactor is clean, parity-correct, type-safe, and preserves the FREE100 golden path. No user-visible string lost vs prior `isVi` ternaries (verified by re-reading both client.tsx + onboarding-steps.tsx against welcome.* keys). 3 minor issues found — none blocking. Score deducted 0.8 for: validator blind-spot on template literals (latent — current keys all exist but no guard for future drift), 3 orphan keys, missing aria-live on success state.

---

## Critical Findings
**None.**

---

## Major Findings
**None.**

---

## Minor Findings

### M1. Validator blind-spot for template-literal `t()` calls — latent risk
**File:** scripts/validate-i18n-keys.mjs:56 + welcome-onboarding-steps.tsx:95,97,108
**Issue:** Validator regex `/\bt\(['"`]([a-zA-Z0-9_.]+)['"`]\)/g` only matches **literal** string keys. The dynamic forms:
- `t(\`steps.${step.key}.title\`)` line 108
- `t(\`steps.${step.key}.description\`)` line 97
- `t('steps.firstSop.installedPrefix', { count })` line 95 — **literal but with second arg, NOT matched by `t('...')`-suffix regex** (regex ends with `\)`)

Are **silently skipped** by validator. Currently all 11 dynamic keys exist (verified), but adding a 6th `StepKey` without translation would not fail CI. Tester's "0 missing keys" gives false confidence here.

**Recommendation (DEFER):** loosen regex from `\)` terminator to `[,)]`:
```js
const regex = /\bt\(['"`]([a-zA-Z0-9_.]+)['"`]\s*[,)]/g;
```
For template literals add a second pass that extracts string segments and warns "dynamic key — verify manually". OR: declare a registry in code: `const STEP_KEYS = ['accountCreated', 'configureKeys', ...] as const` and have validator import + validate each `welcome.steps.{key}.title|description`.

**Why DEFER:** doesn't break current ship. File a follow-up issue.

### M2. Orphan keys in welcome.telegram namespace
**File:** messages/vi.json:2078, en.json:2078 (and 2 below)
**Issue:** 3 unused keys remain after refactor:
- `welcome.telegram.linkedSuccess` (replaced by `openedHint`)
- `welcome.telegram.errorTokenInvalid` (never wired up)
- `welcome.telegram.errorTokenExpired` (never wired up)

Verified zero references in src/.

**Recommendation (LAND NOW):** delete the 3 keys from both vi.json + en.json. Trivial.

### M3. Success state missing aria-live announcement on Telegram CTA
**File:** welcome-page-client.tsx:140-144
**Issue:** When `telegramLinked` becomes true, the success message replaces the button silently. Screen readers may not announce the state change because the inner `<div>` has no `aria-live` (compare resend-success at line 221 which has `aria-live="polite"`).

**Recommendation (DEFER):** add `aria-live="polite"` to the success div wrapper.

### M4. JSDoc comment touch on onboarding-steps.tsx:8 was unnecessary
**File:** welcome-onboarding-steps.tsx:8
**Issue:** Task description claims comment edit was "validator workaround". Verified: validator regex requires `(`-paren after the function name. JSDoc text mentioning `next-intl welcome.steps.*` does NOT match. Workaround was not required. The added comment is harmless (improves docs), but the framing in the plan was inaccurate — no comment-style guard needed.

**Recommendation:** No action — comment is good documentation. Just don't add a "validator-comment-guard" rule.

---

## Edge Case Analysis

| Case | Path | Result |
|---|---|---|
| `data.tier` empty string | DB column `NOT NULL`, no insert path allows `''`. Verified migrations/0064. | ✅ Safe — at worst renders " Plan Activated" |
| `data.tier` undefined | `WelcomeData.tier: string` (non-optional). API returns `handover.tier`. | ✅ Safe |
| `step.descParams === undefined` (steps 1,2,3,5) | Branch in line 93: `step.key === 'firstSop' ? (...) : t('steps.${step.key}.description')`. Only firstSop reads descParams. | ✅ Safe |
| `installedSopsCount === 0` (firstSop) | Line 94: `descParams && installedSopsCount > 0 ? prefix : '' + callToAction` → empty string concat + CTA. | ✅ Safe — renders only "Enable and run a SOP now." |
| `message ?? t('invalid.defaultMessage')` | client.tsx:254. `message` is `string \| null` from prop. `??` falls back ONLY on null/undef, NOT on `""`. | ⚠️ Edge: if upstream ever passes `""`, defaultMessage skipped → empty paragraph. Currently impossible (`setError(...)` always passes truthy string). Acceptable. |
| Server/client namespace parity | page.tsx uses `getTranslations({locale, namespace:'welcome'})`; client uses `useTranslations('welcome')`. Same JSON tree, identical lookup. | ✅ Safe |
| next-intl strict typed-messages | No `IntlMessages` declaration found anywhere → strict mode OFF. Template literals compile. | ✅ Safe |

---

## Golden Path (FREE100) Preservation

Walked the magic-link → welcome → dashboard flow:
1. `/[locale]/welcome/[token]` → page.tsx generateMetadata + render client ✅
2. GET `/api/welcome/validate/${token}` → setData ✅
3. User clicks Get Started → POST validate → `data.redirectUrl ?? /${locale}/dashboard` ✅
4. Telegram CTA optional, non-blocking ✅
5. Invalid → InvalidLinkView with resend form ✅

All user-facing strings re-routed to i18n keys with both locales filled. Zero hardcoded fallback strings. ✅

---

## Bilingual Parity (Tone Check)

VI/EN side-by-side scan of all 39 keys per locale:
- Lengths within reasonable range (no truncation risk in mobile viewports based on existing CSS).
- VI uses informal "anh/chị" consistently for non-tech founder partners. Good.
- "Bắt đầu ngay" vs "Get Started" — tone match ✅.
- "Anh/chị đã yêu cầu quá nhanh. Thử lại sau 1 giờ." vs "Too many requests. Please try again in an hour." — tone match ✅.
- "Sophia đã tạo tài khoản cho bạn" mixes "bạn" with "anh/chị" elsewhere in invalid.* — **inconsistent pronoun** (minor, pre-existing across both old + new copy). NOT introduced by this refactor.

---

## YAGNI / KISS / DRY

- ✅ KISS: one `useTranslations('welcome')` per component, sub-paths via dot notation. Idiomatic next-intl.
- ✅ DRY: `StepKey` union centralizes the 5 keys; `buildOnboardingSteps` returns keys + state only, `StepCard` resolves copy. Clean separation.
- ✅ YAGNI: no premature abstraction. No unused hooks. Step config is data-driven without over-engineering.

---

## Micro-fixes — LAND NOW (1)

**Fix M2: Remove 3 orphan keys**

Delete from both `messages/vi.json` and `messages/en.json` under `welcome.telegram`:
```diff
-    "linkedSuccess": "...",
     "openedHint": "...",
-    "errorTokenInvalid": "...",
-    "errorTokenExpired": "..."
```
~6 lines per locale. Net 12 lines removed. Re-run `node scripts/validate-i18n-keys.mjs` to confirm.

---

## Defer (Follow-up Tickets)

1. **i18n validator coverage gap** (M1) — file ticket: "Extend validate-i18n-keys.mjs to detect template-literal keys via static enumeration or registry pattern". Add `STEP_KEYS` registry export from onboarding-steps.tsx for validator import.
2. **A11y polish** (M3) — add `aria-live="polite"` on telegram success div (1-line fix, group with next a11y pass).

---

## Positive Observations

- Clean separation: server `getTranslations` in page.tsx (metadata), client `useTranslations` in interactive components. Idiomatic.
- `StepKey` union type prevents typos at the call site for `step.key`.
- Translation file structural parity perfect (39/39 keys both locales).
- Both locales have parameterised `{tier}` and `{count}` correctly — no missing ICU placeholders.
- File sizes: client 305 LOC (over 200 LOC guideline by a margin but well-bounded for a top-level page), onboarding-steps 117 LOC ✅, page 33 LOC ✅. Accept.
- Token consumption flow unchanged. POST `/api/welcome/validate/${token}` still single-use.
- Test coverage retained (1931 pass).

---

## Metrics

- Files changed: 5
- LOC delta: +177 / -77 (net +100, mostly i18n keys)
- New unique i18n keys: 30 (per tester)
- Orphan keys introduced: 0 NEW (3 PRE-EXISTING surfaced by review)
- Type coverage: 100% (no new `any`)
- TS errors: 0
- Test pass: 1931/1931

---

## Unresolved Questions

1. Is `welcome.telegram.errorTokenInvalid` / `errorTokenExpired` planned to be wired up in a near-term phase (e.g. surfacing pairing-token errors from `generateTelegramPairingTokenAction`)? If yes, keep keys. If no, delete per M2. Currently `handleConnectTelegram` only logs the error to console (line 71) — never shown to user. **Recommend wiring these to a visible error state in a follow-up.**
2. Should `WelcomeData.tier` be narrowed to `Tier` enum (`BASIC | PREMIUM | ENTERPRISE | MASTER`) instead of `string`? Stronger typing would let `tierActivated` interpolation be type-safe. Out of scope for this refactor but worth noting.
