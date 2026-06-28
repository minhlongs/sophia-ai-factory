# Code Review — Phase 04b + Phase 04a Polish

**Date:** 2026-05-18 04:40
**Scope:** 5 new + 5 modified files in `src/app/[locale]/(admin)/admin/promo-codes/`
**LOC reviewed:** ~800
**Reviewer:** code-reviewer
**Pre-baseline:** TS 0 err / ESLint 340 warn / Vitest 4462 pass / i18n 1121 keys 0 missing

---

## Overall Score: **9.2/10**

**Verdict:** **REVISE** (below 9.5 auto-approve threshold). 1 critical + 4 high-priority fixes. None block merge if owner accepts trade-offs, but C1 is a regression.

**Critical count:** 1
**High:** 4
**Medium:** 4
**Low:** 3

---

## CRITICAL

### C1 — Broken redemptions link (regression, navigation bug)
`promo-codes-table.tsx:133` — `<Link href="admin/promo-codes/${code.id}/redemptions">` is **missing leading `/`**.
From `/[locale]/admin/promo-codes` it resolves to `/[locale]/admin/promo-codes/admin/promo-codes/<id>/redemptions` → **404**.
Fix: prepend `/` → `/admin/promo-codes/${code.id}/redemptions` (next-intl handles locale prefix on root-anchored hrefs).
Impact: External-link icon on every row navigates to dead URL.
Pre-existing? Possibly — verify against `git log -p` of original `promo-codes-client.tsx`; if pre-existing, severity → HIGH but still must fix in this phase since the table moved.

---

## HIGH

### H1 — Server/client filter divergence: CSV export includes rows the user can't see
`csv-export-action.ts` passes `appliesToTier` to `listAdminCodes`. Repo SQL: `AND (applies_to_tier = ?N OR applies_to_tier IS NULL)` — so tier filter on server **also returns universal (null-tier) codes**.
Client filter in `promo-codes-client.tsx:39`: `if (tierFilter !== "all" && c.applies_to_tier !== tierFilter) return false` — **excludes nulls** (`null !== "BASIC"` → filtered out).
Result: CSV row count > visible row count when filter active. Admin downloads "Tier=BASIC" CSV but receives universal codes too. Silent data divergence.
Fix options: (a) align client filter to include nulls (semantically "all tiers including this one"), OR (b) align server: do not pass `appliesToTier` to repo, post-filter in action with strict `!==` match.
Recommend (b) — repo's tier OR-null semantic is correct for **redemption matching** but wrong for **admin browsing**.

### H2 — CSV cell injection risk (description field, code field)
`escapeCsvField` quotes + escapes `"` but does not sanitize leading `=`, `+`, `-`, `@` chars.
- Bulk generator's `description` (line 64 of `bulk-form-client.tsx`) is user input → flows to DB → flows to CSV.
- `code` is server-generated (`FREE100-XXXX` base32) so safe today, but defense-in-depth.
Fix: prefix any cell value starting with `=|+|-|@|\t|\r` with leading `'` or wrap differently. ~5 LOC change in `csv-export-action.ts`.
Severity HIGH because Excel auto-executes formulas; an attacker-controlled description like `=cmd|'/c calc'!A1` is a known XSS-equivalent vector.

### H3 — Hardcoded strings remain in `promo-codes-table.tsx`
Line 72: `<th>Discount</th>` — hardcoded English.
Line 77: `<th>Actions</th>` — hardcoded English.
Line 88: `title="Copy code"` — hardcoded.
Line 123: `title={code.status === "active" ? "Disable" : "Enable"}` — hardcoded.
Line 134: `title="View redemptions"` — hardcoded.
Line 121: `New Code` (in promo-codes-client.tsx:121) — hardcoded.
i18n contract violated: doctrine says "no hardcoded strings in JSX". Add 5–6 keys to `list.*` + `bulk.*`. Tests for i18n parity will still pass (parity only checks keys defined, not usage).

### H4 — Orphan i18n keys
`list.columnMaxUses` (vi/en) defined but never used (table merges into `columnUsed` cell `N / M`).
`list.columnCreated` (vi/en) defined but never used (column doesn't exist in table).
Either add columns or remove keys. Phase 04a precedent (`bulkButton` orphan) was caught — same hygiene needed here.

---

## MEDIUM

### M1 — Stale page state after filter narrows result set
Filters reset page to 1 ✓. But search debounce-less typing can leave user on page>totalPages momentarily if filter expands; conversely if filter narrows after page change without re-filtering (impossible flow currently — OK). However: if `setPage(2)` then `search` reduces filtered to <50, no clamp → table renders empty page. `pageRows = rows.slice((2-1)*50, 100)` = `[]`. Prev button disabled at `page<=1` only; Next disabled at `page>=totalPages` only. With page=2, totalPages=1, Next is disabled but page=2 is "above" — user sees empty + "Page 2 of 1".
Fix: `useEffect` clamping `page` to `Math.min(page, totalPages)` after `filtered` changes, OR include `if (page > totalPages) setPage(totalPages)` in filter handlers. ~3 LOC.

### M2 — Duplicate results count display
`promo-codes-client.tsx:105` shows `{t("resultsCount", { count: filtered.length })}` in toolbar.
`promo-codes-filter-bar.tsx:78` shows the same. Two identical labels above table.
Pick one location.

### M3 — Silent failure on toggle API error
`handleToggle` (line 51) does `if (res.ok) { ... }` with no else, no toast, no error state. Admin sees button re-enable but nothing changed. Pre-existing pattern but worth flagging.

### M4 — Pagination total label localization
`promo-codes-table.tsx:165`: `{t("pageLabel")} {page} {t("pageOf")} {totalPages}` — string-concat with spaces. Works in vi+en but fragile for RTL/word-order locales. Use a single ICU template: `t("pageStatus", { page, total: totalPages })`. Future-proofing only; not blocking.

---

## LOW

### L1 — `promo-codes-table.tsx` `PAGE_SIZE` exported but also imported from same file in client; tight coupling
Constant `PAGE_SIZE = 50` lives in table file and is consumed by orchestrator (`totalPages = Math.ceil(filtered.length / PAGE_SIZE)`). Cohesion is fine but a future refactor to make page size user-configurable will require lifting state. Note only.

### L2 — `escapeCsvField` wraps every cell in quotes unconditionally
Slightly over-quotes (numbers and empty cells too). Excel/Sheets parse OK. Minor file-size bloat. Acceptable trade-off for simplicity.

### L3 — `Date.UTC(y, m-1, d, 23-7, 59, 59)` — intentional `23-7` left as arithmetic for readability
Reviewer note: this is fine; comment is excellent. `23-7=16` (Vietnam offset). VN has no DST → safe. No off-by-one (month 0-indexed handled). ✓

---

## TIMEZONE FIX (C1 from prior review) — VERIFIED ✓

`Date.UTC(2026, 11, 31, 16, 59, 59)` = `2026-12-31T16:59:59.000Z` = `2027-01-01T00:00:00 +07:00 minus 1 second` = `2026-12-31 23:59:59 GMT+7` ✓.
Comment (lines 32-41) is exemplary — explains *why* not just *what*. Approve.

---

## SPLITS (C3 from prior review) — VERIFIED ✓

- `bulk-form-client.tsx` 249 → 126 LOC ✓
- `bulk-request-form.tsx` 91 LOC ✓
- `bulk-result-panel.tsx` 73 LOC ✓
- Component boundaries natural: request-form owns inputs, result-panel owns success view, orchestrator owns state + API call.
- Props minimal (no drilling).
- State stays in orchestrator ✓.
- Each sub-component independently testable ✓ (pure props in, callbacks out).
- `MIN_COUNT`/`MAX_COUNT` re-export from orchestrator preserves public API surface ✓.

---

## SECURITY ASSESSMENT

| Check | Result |
|---|---|
| Server Action `'use server'` directive | ✓ Line 1 |
| Admin gate (defense-in-depth vs page guard) | ✓ Lines 64-67 |
| Bypass via direct fn import? | ✓ Server Actions require POST with action ID — Next.js enforces |
| `codePrefix` SQL inject risk | ✓ Filtered client-side after fetch with `String.includes` — no SQL |
| DoS cap `limit: 10000` | ⚠ Acceptable; if codes grow >10k, silent truncation — add log when filtered.length === MAX |
| Zod validation on filters | ✓ `FilterSchema.safeParse` with fallback to empty object |
| `appliesToTier` enum constrained | ✓ Tier values whitelisted (BASIC/PREMIUM/ENTERPRISE/MASTER) |
| CSV cell injection | ❌ See H2 |
| Polar references | ✓ None |
| `console.*` | ✓ None |
| `:any` | ✓ None |

---

## CORRECTNESS ASSESSMENT

| Check | Result |
|---|---|
| Pagination off-by-one | ✓ `slice((page-1)*50, page*50)` correct; `totalPages = max(1, ceil(n/50))` correct |
| Empty filter "Page 1 of 1" | ✓ |
| Reset to page 1 on filter change | ✓ all 3 handlers |
| Prev/Next disabled at boundaries | ✓ |
| CSV uses filtered set | ✓ server filters, client codePrefix re-filters |
| Tier filter null-handling | ❌ See H1 |
| Redemptions link | ❌ See C1 |
| Toggle button disabled on `expired` | ✓ Line 122 |
| `valid_until` null → "neverExpires" | ✓ Line 111 |
| Copy code feedback | ✓ 1.5s timeout |

---

## UX ASSESSMENT

| Check | Result |
|---|---|
| Loading state on Export button | ✓ `isPending` from `useTransition`, button disabled + "Exporting..." label |
| No-results state | ✓ `noResults` row when filter matches 0 |
| Pagination boundaries | ✓ |
| Reset state on filter change | ✓ page only — search/status/tier are user-driven |
| Success feedback on CSV download | ⚠ Silent; CSV downloads via blob → no toast confirming N rows exported. Minor. |
| Admin role mismatch redirect | ✓ Server Action redirects to `/dashboard` |

---

## I18N ASSESSMENT

| Check | Result |
|---|---|
| 26 new keys defined in vi/en | ✓ Bilingual parity |
| All keys actually used | ❌ `columnMaxUses`, `columnCreated` orphan |
| Hardcoded strings in JSX | ❌ 6 instances (see H3) |
| Plural/ICU usage | ✓ `resultsCount: "{count} mã"` (note: Vietnamese has no plural — single form OK) |
| `bulkButton` key reused (Phase 04a fix) | ✓ `page.tsx:38` |

---

## TOP 3 FINDINGS

1. **C1**: Redemptions link missing leading `/` → 404 on every row click.
2. **H1**: Server-side tier filter includes null-tier codes; client-side excludes them → CSV ≠ visible table.
3. **H2**: CSV cell injection risk on `description` field — Excel formula execution vector.

---

## METRICS

- LOC reviewed: 800
- Files: 5 new + 5 modified
- Critical: 1 | High: 4 | Medium: 4 | Low: 3
- File size compliance: ✓ all <200 LOC
- Type Safety: ✓ 0 `:any`, 0 ts-ignore
- Console hygiene: ✓
- Cross-layer rules: N/A (admin routes, outside 4-layer)
- Doctrine (no Polar, no operator setup): ✓

---

## VERDICT: **REVISE**

Below 9.5 auto-approve threshold due to C1 (broken link is a user-visible regression) + H1/H2 (data integrity + security).

**Minimum to reach 9.5+:**
1. Fix C1 (add leading `/` to Link href) — 1 LOC
2. Fix H1 (align server/client tier-filter semantics) — ~5 LOC
3. Fix H2 (CSV cell injection prefix) — ~5 LOC
4. Either remove orphan i18n keys (H4) or add columns

**Estimated revision time:** 15–30 minutes.

After fixes, score → **9.6/10** (one residual H3 hardcoded-string nit + medium polish items can defer to next iteration).

---

## POSITIVE OBSERVATIONS

- Excellent timezone comment block (lines 32-41 of `bulk-form-client.tsx`) — explains *why* GMT+7 math is correct
- Clean component split: orchestrator owns state, leaves render to pure children
- `useTransition` for Server Action correctly wired with `isPending`
- Defense-in-depth admin gate in Server Action despite page guard
- Zod validation with `safeParse` + fallback (graceful degradation)
- File-size discipline: every new file <200 LOC ✓
- Reuse of existing `bulkButton` key (Phase 04a polish achieved)
- `revokeObjectURL` properly cleans up blob URLs (no memory leak)

---

## UNRESOLVED QUESTIONS

1. Should "tier filter" semantically include universal (null-tier) codes? Repo SQL says yes (redemption-matching context), but admin browsing says ambiguous. Product call.
2. Is the 10k DoS cap acceptable as silent truncation, or should the action return a `truncated: true` flag for the UI to warn admin?
3. Should bulk-generate `description` field be sanitized server-side (DB layer) to reject formula-prefix chars, removing CSV concern at source?
