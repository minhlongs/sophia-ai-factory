# Code Review — Wave 1: Non-Tech Self-Serve Onboarding (Help Center)

**Date:** 2026-05-12 07:27
**Reviewer:** code-reviewer
**Scope:** 3 NEW + 1 EDITED file, ~700 LOC content pages, dashboard shell sidebar
**Work context:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`

---

## Scope

| File | Status | LOC | Pattern |
|---|---|---:|---|
| `src/app/[locale]/dashboard/help/page.tsx` | NEW | 168 | matches sibling ✅ |
| `src/app/[locale]/dashboard/help/faq/page.tsx` | NEW | 287 | extends sibling pattern w/ `Section[]` ✅ |
| `src/app/[locale]/dashboard/help/troubleshooting/page.tsx` | NEW | 365 | extends sibling pattern w/ `Severity` ✅ |
| `src/app/[locale]/dashboard/layout.tsx` | EDITED | n/a | 1-line href change ✅ |

Reference sibling: `help/getting-started/page.tsx` (129 LOC). New pages follow the same Server Component + `params: Promise<{locale: string}>` + `const X_VI/X_EN` + `locale.startsWith('vi')` + lucide-react + dark Tailwind pattern.

**Tests:** 4,078/4,110 pass (32 skipped, 0 failures, 34.97s) — passed before review per upstream.

---

## Overall Assessment

Solid, content-focused Server Components with clean bilingual structure. Pattern parity with sibling is high. Accessibility baseline good (`aria-hidden` on decorative icons, semantic `<details>`/`<ol>`/`<h1>`/`<h2>`, native disclosure widget for FAQ). Zero `:any`, zero `console.log`. Land layer presentation only — no service imports, no cross-layer violation. File sizes (287/365 LOC) exceed the 200-LOC guideline but are reasonable for content pages where each LOC is mostly bilingual copy — the rule has a "flexible for content pages" carve-out.

**Score: 8.5 / 10**

Deducted for:
- HIGH: 2 dead-route references (`/welcome/invalid`, `/welcome/expired`) — links go to a dynamic catch-all that treats them as invalid tokens, creating a confusing user loop. (-1)
- MEDIUM: Inconsistent severity-label translation key (Vietnamese "Nghiêm trọng" reads "Critical" whereas English "High" — semantically not matched). (-0.25)
- MEDIUM: One FAQ answer leaks an implementation detail (HeyGen key prefix `"ZmJj..."`) which is OK as guidance but could date poorly. (-0.25)

---

## Critical Issues

**None.** No secrets, no XSS surface (no `dangerouslySetInnerHTML`, no `eval`, all text static), no auth bypass risk (Server Components inside auth-gated `/dashboard` shell), no DB/API touch.

---

## High Priority

### H1. Broken link integrity: `/welcome/invalid` and `/welcome/expired` do not exist as routes

**Files:** `faq/page.tsx:46,136`; `troubleshooting/page.tsx:38,40,153,155`; `faq/page.tsx:45,135` (copy mentions `/welcome/expired`).

**Verification:**
```bash
$ find src/app/[locale]/welcome -name "page.tsx"
src/app/[locale]/welcome/[token]/page.tsx       # ONLY route under /welcome
$ grep -rn "welcome/invalid\|welcome/expired" src/ --include="*.tsx"
# only the 6 occurrences in the new help pages — no implementation anywhere
```

The dynamic `[token]/page.tsx` catch-all will receive the string `"invalid"` (or `"expired"`) as a token and almost certainly render an "invalid token" page — confusing UX because the non-tech client clicks "Resend magic link", lands on an error-looking screen, and has no path forward.

**Impact:** This is the centerpiece self-recovery flow for the magic-link onboarding (which is Sophia's protected flow #2). A non-tech CEO who has lost their magic link will be funneled into a dead end by both the FAQ and the Troubleshooting page.

**Fix (pick one):**
- **Option A (preferred):** Build the `/welcome/invalid` (or `/welcome/resend`) page with the email-resend form referenced in the copy. This is the genuine self-serve fix.
- **Option B (interim):** Change all 6 hrefs to `/login` (which already supports magic-link resend) and update copy to say "Use the email field at /login to resend." Removes the dead route while still serving the recovery intent.

**Decision required from product before commit** — Option A is correct but is its own ticket; Option B is a same-PR copy edit.

---

## Medium Priority

### M1. Severity label translation mismatch (`troubleshooting/page.tsx:259-275`)

```ts
high:   { label: { vi: 'Nghiêm trọng', en: 'High' } }     // "Nghiêm trọng" = "Critical/Severe"
medium: { label: { vi: 'Trung bình',  en: 'Medium' } }   // OK
low:    { label: { vi: 'Thấp',        en: 'Low' } }      // OK
```

Vietnamese "Nghiêm trọng" reads as "Critical" / "Severe", which is stronger than English "High". A "Magic link in spam" issue marked Nghiêm trọng will alarm the client unnecessarily. Use **"Cao"** to mirror English "High" exactly, or change EN to **"Critical"** to mirror VI — pick one polarity.

**Suggested:** `vi: 'Cao'` (preserves the calm tone the rest of the copy uses).

### M2. Provider key prefix sample may date poorly (`faq/page.tsx:64,154`)

> "Copy toàn bộ chuỗi (bắt đầu bằng "ZmJj..." hoặc tương tự)"

HeyGen rotates token formats. If they change the prefix in 6 months this copy becomes wrong. Soften to: "Copy toàn bộ chuỗi do HeyGen cung cấp." (Same for EN.)

### M3. `getting-started/page.tsx` is missing `aria-hidden` on its `CheckCircle` icon (line 98)

Not a Wave 1 file, but: the new `help/page.tsx` correctly adds `aria-hidden="true"` to icons. The sibling does not. Worth a follow-up consistency pass — flag for Wave 2 cleanup, do not block this PR.

### M4. File size 365 LOC (`troubleshooting/page.tsx`) above 200-LOC guideline

Acceptable for content pages, but consider extracting `ISSUES_VI` / `ISSUES_EN` to a co-located `data.ts` if the list grows to 15+. Not blocking.

---

## Low Priority

### L1. `key={i}` on `.map()` items (`help/page.tsx:114` uses `r.href` — good; `faq/page.tsx:236`, `troubleshooting/page.tsx:300,323` use array index).

Acceptable here because list is static + never reordered, but switching to a stable key (e.g. slugified `item.q`) would be marginally better for React reconciliation if items shuffle. Not blocking.

### L2. The badge text on `help/page.tsx` (`"Start here"` / `"Bắt đầu ở đây"`) uses a fixed `text-[10px]` arbitrary value. Sibling-consistent with the severity badge in troubleshooting — leave as-is.

### L3. `metadata.title` does not localize.

Both VI and EN visits show the English title `"Help Center | Sophia AI"`. Acceptable for now (Next.js metadata + dynamic locale needs `generateMetadata`), and sibling does the same. Not blocking.

### L4. Email "phản hồi trong 1h" is a customer-facing SLA commitment.

`help/page.tsx:163` claims "within 1 business hour" response. Confirm with ops this is the stated SLA. If unsure, soften to "Phản hồi trong 24h làm việc."

---

## Edge Cases Found (Scout)

1. **Locale fallback for non-`vi`/`en` locales:** `locale.startsWith('vi')` makes any unknown locale (e.g. `fr`) default to EN. Sibling-consistent. Middleware restricts to `['en','vi']` (verified `src/middleware.ts:36`), so unreachable. ✅
2. **Server-rendered `<details>` open state:** Will render closed by default — accessible via keyboard. Native HTML element, no JS required. ✅
3. **Absolute `href`s without locale prefix:** Middleware uses `localePrefix: 'as-needed'`, so absolute paths are rewritten correctly. ✅
4. **`mailto:` link:** Always absolute. Not affected by locale. ✅
5. **`hrefs` to `/dashboard/billing` (`troubleshooting/page.tsx:94,209`):** Route confirmed at `src/app/[locale]/dashboard/billing/page.tsx`. ✅
6. **`/dashboard/sops`, `/dashboard/sop-marketplace`, `/dashboard/byok`, `/dashboard/system-health`, `/dashboard/videos`, `/dashboard/settings`, `/dashboard/billing`:** All exist. ✅
7. **`/guide/telegram`, `/guide/faq`, `/pricing`, `/login`, `/setup-wizard`:** All exist. ✅
8. **`/welcome/[token]`** only — `/welcome/invalid` and `/welcome/expired` **DO NOT EXIST** (H1 above). ❌
9. **`layout.tsx` sidebar change** `support` → `/dashboard/help`: clean 1-line. Translation key `sidebar.support` reused (line 171). Consider renaming key to `sidebar.help` in Wave 2 for clarity, but not strictly needed because the visible label text is locale-controlled.

---

## Positive Observations

- ✅ Perfect pattern parity with sibling — same imports, same prop shape, same Tailwind classes
- ✅ Bilingual content well-written, non-tech tone, no jargon
- ✅ VI accents correct throughout (`khoá`, `tuỳ chọn`, `phụ thuộc` etc.) — confirmed
- ✅ EN grammar clean (only minor: "alt avatar" on line 149 is informal but readable in product context)
- ✅ Semantic HTML: `<h1>`, `<h2>`, `<ol>`, `<details>`, `<summary>`, `<section>` used appropriately
- ✅ Accessibility: `aria-hidden="true"` on all decorative icons (10/10 in new files); native `<details>` is keyboard-accessible by default
- ✅ Zero `:any`, zero `console.log`, zero `@ts-ignore`
- ✅ Mutual back-linking: FAQ links to Troubleshooting (line 270-275) and Troubleshooting → email (line 354-360). FAQ links 4 issues → Troubleshooting page (line 73, 163). Both link to email fallback. ✅
- ✅ No internal hostnames, no API keys, no secret leakage. `support@sophia.agencyos.network` is the published contact.
- ✅ Severity color coding (red/amber/zinc) is consistent with the dark theme and provides at-a-glance scanability
- ✅ Cross-layer architecture compliance: pure `land` layer presentation, no service imports — no violation of `cross-layer-orchestration.md`
- ✅ Stable hrefs as React keys where used (`help/page.tsx:118`)

---

## Recommended Actions (in order)

1. **Resolve H1 before commit.** Either ship the `/welcome/invalid` page (Option A, separate ticket OK if approved) OR change the 6 hrefs to `/login` in this same PR (Option B). Do not ship the help center pointing to dead routes.
2. Fix M1 severity label (`vi: 'Cao'`) — 1-line edit.
3. Soften M2 HeyGen prefix copy — 1-line edit each language.
4. (Wave 2) Add `aria-hidden` to sibling `getting-started/page.tsx` icon and consider renaming `sidebar.support` → `sidebar.help` translation key.

---

## Metrics

| Metric | Value | Target | Status |
|---|---:|---|---|
| `:any` types | 0 | 0 | ✅ |
| `console.*` calls | 0 | 0 | ✅ |
| `@ts-ignore` | 0 | 0 | ✅ |
| TS errors in new files | 0 | 0 | ✅ |
| Test pass rate | 4078/4110 | 100% (excl. skipped) | ✅ |
| Files > 200 LOC | 2 of 3 new | <200 ideal, flexible content | ⚠️ acceptable |
| Dead route links | 2 | 0 | ❌ H1 |
| Pattern parity w/ sibling | 100% | 100% | ✅ |

---

## Verdict

**🟡 GREEN-LIGHT WITH ONE CONDITION**

Merge-ready provided H1 (dead routes) is handled in this same PR — either via Option A (build the page) or Option B (redirect to `/login`). Without either fix, the help center actively misleads non-tech clients into a broken recovery flow, which contradicts the entire purpose of Wave 1.

All other findings are non-blocking and can be folded into Wave 2.

---

## Unresolved Questions

1. **H1 resolution choice:** does product want the dedicated `/welcome/invalid` page now (delays Wave 1 by ~1-2h work) OR the `/login`-redirect copy fix (ships immediately)?
2. **L4 SLA:** is "1 business hour" the agreed support SLA, or should this say "24 business hours" to avoid commitment risk?
3. **M3 follow-up:** include `aria-hidden` consistency pass on `getting-started/page.tsx` icon in this PR (1 line) or defer to Wave 2?
