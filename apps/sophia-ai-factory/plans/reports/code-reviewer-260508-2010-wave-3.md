# Wave 3 Code Review — Sophia AI Factory (F-1 to F-8)

**Date:** 2026-05-08 20:10
**Reviewer:** code-reviewer agent
**Scope:** Wave 3 surgical sweep — 9 source files + en.json + vi.json
**Score:** **9.3/10**
**Verdict:** **APPROVED for deploy**. Zero critical. Two small i18n misses + minor UX/cleanliness items.

---

## Summary

Wave 3 cleanly delivered all 8 fixes. Build/test/i18n validator all green:
- 2810/2810 tests pass; tsc 0 errors
- i18n validator: 1878 t() calls, 817 unique keys, **0 missing**
- en.json ↔ vi.json: **1293 keys each, perfect parity, zero diff**
- Banned imports: 0; `:any` types: 0 in modified files; `console.*`: 0
- `landing.guide.telegram`: 33 keys both locales, all rich-text tag pairs balanced

The implementations are pragmatic and correct. F-3 try/catch is defensive (the underlying `getCurrentUserFromHeaders` already catches and returns null) but harmless. F-6 t.rich uses safe React-callback rendering (no XSS risk). F-7 inline banner has `role="alert"` for accessibility.

---

## Findings by Severity

### CRITICAL — 0
None.

### HIGH — 0
None.

### MEDIUM

**M-1. Residual hardcoded English in billing page (F-5 sweep incomplete)**
File: `src/app/[locale]/dashboard/billing/page.tsx:89,91`
```ts
{ label: 'API Calls', used: ... }
{ label: 'Storage (MB)', used: ... }
```
The `videoGenerationsLabel` got translated, but the sibling labels did not. Both render in QuotaGauge column 1 + 3.
Fix: add `dashboard.billing.apiCallsLabel` + `dashboard.billing.storageLabel` to en.json/vi.json, replace hardcoded literals.

**M-2. nextError banner not cleared on Back button (F-7 UX)**
File: `src/app/[locale]/setup-wizard/page.tsx:444`
The Back handler `onClick={() => setStep(prev => prev - 1)}` does NOT call `setNextError(null)`. If user fails Next on step 2, then clicks Back, the error banner stays visible on step 1. Same applies to any direct step jumps.
Fix: extract `goToStep(n)` helper that clears `nextError` + sets step, use in both Next/Back paths.

### LOW

**L-1. Stale comment in setup-wizard layout**
File: `src/app/[locale]/setup-wizard/layout.tsx:57-62`
After F-1 move, the file IS inside `[locale]` segment, so the comment "/setup-wizard sits outside the [locale] segment, so next-intl's request middleware never tags the request with a locale" is now misleading. The cookie-based locale fallback may still serve as a defensive default, but the rationale comment is wrong.
Fix: rewrite comment to reflect current reality (e.g., "Read locale from cookie as primary source — middleware locale tagging may not always populate request context for layouts deep in [locale]").

**L-2. F-3 try/catch redundancy (cosmetic)**
Files: `src/app/api/v1/integrations/channels/route.ts:33-39`, `src/app/api/v1/integrations/affiliate-networks/[network]/route.ts:35-42`
`getCurrentUserFromHeaders` (`seed/auth/better-auth-session.ts:60-80`) already wraps everything in try/catch and returns `null` on error. The extra outer try/catch in F-3 only catches bugs in synchronous Header access, which are not realistic. Harmless defense-in-depth — keep if you want, but the inline `logger.warn` "auth lookup threw" will essentially never trigger.

**L-3. setup-wizard/page.tsx file size 503 LOC**
Pre-existing condition (Wave 3 added ~10 lines). Sophia rule says ≤200 LOC. Future work: extract `useSetupWizardState` hook + `WizardFooter` component.

**L-4. landing.guide.telegram namespace location**
The page is at `[locale]/guide/telegram/` but uses `landing.guide.telegram.*` namespace. Other guide pages don't share this pattern. Pre-existing convention — does not affect SEO (namespace is internal i18n addressing only, not URL/meta). Cosmetic.

### POSITIVE OBSERVATIONS

- F-1 file move: zero broken imports. All 4 references in `middleware.ts`, `getting-started`, `pricing`, `dashboard-setup-steps`, etc., point to `/setup-wizard` URL which Next.js still resolves via the `[locale]` segment.
- F-4 PEV_STAGES type drop of `label` field: confirmed only-local usage via grep, safe refactor.
- F-6 t.rich usage: idiomatic next-intl pattern. Tag callbacks `mono`, `strong`, `em` render as React elements via JSX, immune to XSS by construction.
- F-7 banner has `role="alert"` for screen-reader live-region announcement. Strong UX.
- F-8 `useTranslations('dashboard.missions.control')` namespace + `agent_loading` key correctly added to both locales.
- All modified API routes correctly return `401 Unauthorized` (was previously throwing → 500).

---

## Edge Cases Scouted

1. **F-1 move**: `middleware.ts` redirects to `/setup-wizard` (no locale prefix). Next-intl middleware will rewrite this to `/{locale}/setup-wizard` based on cookie/Accept-Language → file resolves correctly.
2. **F-3 unauth path**: legit auth flow preserved — `safeGetUser` → `null` → `401` short-circuits before D1 access. No user-context leak.
3. **F-7 nextError**: Banner stays through Back nav (M-2 above), but does NOT persist across full page reload (state is component-local). Acceptable.
4. **F-6 tag pairs**: All 9 rich-text strings balanced across en+vi (verified programmatically).

---

## Metrics

| Metric | Value |
|---|---|
| Type Coverage (modified files) | 100% |
| `:any` count (modified) | 0 |
| Banned imports (modified) | 0 |
| Test pass | 2810/2810 |
| tsc errors | 0 |
| i18n missing keys | 0 |
| en/vi parity | 1293/1293 |
| Files >200 LOC | 1 (setup-wizard/page.tsx, pre-existing) |

---

## Recommended Actions

1. **Before deploy (5 min):** Fix M-1 — translate `'API Calls'` and `'Storage (MB)'` in billing page.
2. **Before deploy (3 min):** Fix M-2 — clear `nextError` on Back.
3. **Optional (post-deploy):** L-1 stale comment, L-3 file split.

None of M-1/M-2 block deploy individually but together they're a 10-minute polish win.

---

## Unresolved Questions

- L-4: should `landing.guide.telegram` namespace be migrated to `dashboard.guide.telegram` or `guide.telegram` for consistency? Out of scope for Wave 3.
