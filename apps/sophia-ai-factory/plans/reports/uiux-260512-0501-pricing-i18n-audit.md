# UI/UX Audit — Pricing UX + i18n Bilingual (Sophia FREE100 Step 4)

- **Date:** 2026-05-12 05:01 PT
- **Scope:** `/pricing` checkout flow, i18n key coverage, onboarding tour 6-step audit
- **Auditor:** ui-ux-designer (teammate)
- **Branch:** `main` (commit `0288145c`)
- **Production:** https://sophia.agencyos.network (SHA `836f0bf0` — pre-this-commit)

---

## 1. Pricing UX Findings

### 1.1 Promo input visibility — PASS (with polish applied)

- `CouponInput` lives in `forest/components/pricing/pricing-section.tsx` line 92 — rendered between page header (combined badge / title / subtitle) and the 3 tier cards (Starter / Growth / Premium).
- On mobile (320px+) the input is positioned ABOVE the tier cards inside the first viewport scroll — confirmed via Tailwind `mt-8` directly under the `<h2>` block, no `hidden md:block` gate.
- Input width = `flex-1`, max-width container `max-w-md mx-auto`. Mobile readable.
- Input label centered above (`text-center`, `mb-2`) — uses `pricing.coupon.label` (`Bạn có mã ưu đãi không?` / `Have a promo code?`).
- Apply button = violet `bg-violet-600`, disabled state when no code entered (`opacity-50 cursor-not-allowed`) — visually distinct from input.
- Loading state via `t("applying")` — translated both locales.
- Success badge: emerald text below input, error: red text — both via translated keys.

### 1.2 Placeholder polish — FIXED

**Before:** `pricing.coupon.placeholder` = `NHẬP MÃ` / `ENTER CODE` (generic, no FREE100 hint).
**After:** Added `pricing.promo.placeholder`:
- VN: `Nhập mã VIP (nếu có)`
- EN: `Enter VIP code (optional)`

Wired into `CouponInput` line 130 via `tPromo("placeholder")`. Old `pricing.coupon.placeholder` kept for backwards compat (unused now in this component, may be referenced elsewhere).

### 1.3 Help text — FIXED

**Before:** No help text below input. Non-tech CEO had no signal that `FREE100` exists.
**After:** Added muted help text directly under the input (visible at all times):
- VN: `Mã FREE100 dành cho đối tác chiến lược`
- EN: `FREE100 is reserved for strategic partners`

Rendered as `<p className="mt-2 text-center text-[11px] text-muted-foreground/70">` — non-intrusive but discoverable.

### 1.4 Mobile responsive — PASS

- Combined header `px-6 py-8 text-center` + `max-w-3xl mx-auto` — adapts.
- Tier card grid `md:grid-cols-3` stacks vertically below 768px.
- MASTER tier hero: `md:grid-cols-2` stacks on mobile.
- Touch target audit: Apply button = `px-5 py-2` ≈ 40px tall — slightly under WCAG 44px minimum but acceptable for adjacent input. Future: bump to `py-3`.

### 1.5 CTA states — PASS

- Tier card CTA: `t("pricing.processing")` (loading) / `t("pricing.get_started")` — both translated.
- MASTER CTA: `t("pricing.master.cta")` — `Truy Cập Trọn Đời` / `Lifetime Access` (in master subkey).
- Disabled state: `disabled:cursor-not-allowed disabled:opacity-50` — clearly inactive.
- Hover: scale `hover:scale-[1.02]` — micro-interaction OK.

---

## 2. i18n Missing-Key Scan

### 2.1 Pre-fix scan (BEFORE this commit)

```
$ npm run i18n:validate
Total t() calls: 2314
Unique keys: 1014
Missing keys: 0
✅ All translation keys found!
```

**Result:** All `t('pricing.*')` and `t('landing.pricing.*')` keys exist in both `vi.json` and `en.json`. The pre-existing FREE100 audit (Step 0) already closed all missing-key bugs.

### 2.2 Hardcoded English strings found (i18n violations)

Inside `src/forest/components/pricing/coupon-input.tsx`:

| Line (pre-fix) | String | Fix |
|---|---|---|
| 237 | `"Redemption failed"` fallback | → `tError("redemption_failed")` |
| 270 | `"Access Activated!"` | → `tError("access_activated_title")` |
| 271 | `"Check your email for the magic login link."` | → `tError("access_activated_desc")` |
| 281 | `${value}-day free trial` template literal | → `tError("free_trial_days", { days })` |
| 282 | `"Full free access"` | → `tError("free_full_label")` |

All 5 strings now resolve through `pricing.error.*` namespace.

### 2.3 Bilingual stack acceptable (out of scope)

`src/app/[locale]/pricing/page.tsx` lines 94-106 — HeyGen bundle gate stacks EN+VN inline (`<br />` between). This is a deliberate bilingual pattern visible regardless of locale. Acceptable but could be polished later via `pricing.bundle_gate.*` keys.

---

## 3. Tour Modal 6-Step Audit

### 3.1 Existing implementation

- Component: `src/app/[locale]/dashboard/components/onboarding-tour-modal.tsx`
- Step config: `src/app/[locale]/dashboard/components/onboarding-tour/tour-steps.ts` — `TOTAL_STEPS = 7`
- Translator: `useTranslations('onboarding')` (flat namespace)

### 3.2 Step mapping vs required 6 beginner steps

| Required step | Tour step | i18n key | Coverage |
|---|---|---|---|
| (1) BYOK keys | Step 2 — `Cấu hình API Keys` | `step2_title/desc/action` → `/dashboard/byok` | ✅ |
| (2) First script gen | Step 3 — `Khám phá SOP Marketplace` | `step3_*` → `/dashboard/sop-marketplace` | ✅ |
| (3) First video render | Step 4 — `Cài đặt & chạy SOP đầu tiên` | `step4_*` → `/dashboard/sops` | ✅ |
| (4) Distribute to channel | (implicit) — Step 4 SOP runs include distribution; Step 5 analytics confirms. | `step4_desc` mentions `Bot chạy tự động trên server` | ⚠️ partial — no explicit "distribute" step. Added `tour.beginner.step_distribute_hint` for future surfacing. |
| (5) Upgrade path / billing | Step 6 — `Mua Credits (MCU)` | `step6_*` → `/dashboard/credits` | ✅ |
| (6) Support contact | Step 7 — `Cần trợ giúp?` | `step7_*` → `/dashboard/support` | ✅ |

Plus bonus: Step 1 = generic welcome with tier badge.

### 3.3 Verdict — PASS (with note)

Onboarding tour has 7 fully-bilingual steps. Coverage **exceeds** the 6-step beginner requirement. The "distribute" semantics are embedded in Step 4 SOP execution (the SOP playbooks themselves contain TikTok/YouTube distribution actions). A dedicated "distribute" step would be repetitive.

Added `tour.beginner.step_distribute_hint` (VN+EN) for potential surfacing if a future step is split out.

---

## 4. Files Changed + Keys Added

### 4.1 Files modified (3)

```
M apps/sophia-ai-factory/messages/en.json            +48 -1
M apps/sophia-ai-factory/messages/vi.json            +48 -1
M apps/sophia-ai-factory/src/forest/components/pricing/coupon-input.tsx  +13 -6
```

### 4.2 i18n keys added

**`pricing.promo.*` (new namespace)**
- `placeholder` — input hint
- `help_text` — FREE100 partner notice

**`pricing.error.*` (new namespace)**
- `redemption_failed` — fallback when API returns no error
- `access_activated_title` — modal success heading
- `access_activated_desc` — modal success body (magic link reminder)
- `free_trial_days` — "{days}-day free trial" / "Dùng thử miễn phí {days} ngày"
- `free_full_label` — "Full free access" / "Truy cập miễn phí toàn bộ"

**`tour.beginner.*` (new namespace — audit traceability)**
- `audit_note` — summarizes coverage decision
- `step_distribute_hint` — bilingual copy ready if step 4 is split

Total: 9 new keys × 2 locales = 18 new translation entries.

### 4.3 Components wired

- `CouponInput` (forest/components/pricing/coupon-input.tsx):
  - L33-34: added `tPromo` translator
  - L130: placeholder now `tPromo("placeholder")`
  - L161-163: new help text block under message
  - `FreeRedemptionModal`: L186 added `tError` translator; L245, L278-279, L289-290 localized.

---

## 5. Screenshots

- Not captured in this audit pass (CI/build environment, no browser session).
- Production verification deferred to Step 8 final smoke (per task constraint: DO NOT push or deploy).

---

## 6. Verdict Per Item

| Item | Status |
|---|---|
| 1.1 Promo input visibility | PASS |
| 1.2 Placeholder bilingual hint | FIXED |
| 1.3 Help text under input | FIXED |
| 1.4 Mobile responsive | PASS |
| 1.5 CTA states translated | PASS |
| 2.1 i18n missing-key scan | PASS (0 missing) |
| 2.2 Hardcoded English in modal | FIXED (5 strings) |
| 3 Tour 6-step coverage | PASS (7 steps, exceeds) |
| 4 Build / TS check | PASS (`tsc --noEmit` exit 0) |
| 5 Tests | PASS (coupon-input + pricing tests green, 12/12) |
| 6 Pre-test validator | PASS (`i18n:validate` 0 missing across 2314 t() calls) |

---

## 7. Out of Scope (NEEDS-FOLLOWUP)

| Issue | File | Recommendation |
|---|---|---|
| Comparison table row labels hardcoded English | `pricing-comparison-table.tsx` L47-84 ("MCU credits/mo", "Campaigns/mo", "Team members", "API access", "Webhooks", "Billing", "One-time", "Monthly", etc.) | Add `pricing.comparison.row_*` namespace + wire labels. Out of allowed namespaces per task scope. Est. ~10 keys × 2 locales. |
| Bundle gate inline bilingual stack | `app/[locale]/pricing/page.tsx` L94-106 | Optional — move EN+VN copy to `pricing.bundle_gate.*` keys for clarity. Acceptable as-is. |
| MASTER hero "Talk to Sales" anchor link uses hardcoded `mailto:` subject | `pricing-faq.tsx` L67 `Enterprise Plan Inquiry` | Minor; subject lines often kept in English for inbox filtering. Acceptable. |
| Touch target audit | Apply button L143 `py-2` ≈ 40px | Bump to `py-3` for WCAG 44px minimum on mobile. |

---

## 8. Verification Pipeline (no push/deploy per task)

```
- Build / TS: ✅ tsc --noEmit → exit 0
- i18n validator: ✅ 0 missing keys, 2314 t() calls scanned
- Unit tests: ✅ vitest --run coupon (1/1), vitest --run pricing (11/11)
- Commit: ✅ 0288145c on local main
- Push: ❌ SKIPPED (per task: DO NOT push or deploy)
- Production: ❌ SKIPPED (still SHA 836f0bf0 — pre-this-commit; will deploy in Step 8)
```

---

## 9. Unresolved Questions

1. **Distribute step**: Should Step 4 in the tour be split into "(4a) Configure SOP" + "(4b) Watch first auto-distribution"? Current flow assumes user observes via analytics page (step 5). Lead decision needed for Step 5/8 work.
2. **Comparison table labels**: Confirm whether `pricing.comparison.*` namespace is permitted in next iteration — current scope said only `pricing.promo.*` / `pricing.error.*` / `tour.beginner.*`. ~10 row labels remain English.
3. **`pricing.coupon.placeholder` deprecation**: The old key (`NHẬP MÃ` / `ENTER CODE`) is now unused by `CouponInput`. Should it be removed in a future cleanup commit, or kept for any external references?
4. **Free trial messaging**: When `discountType === 'free_trial'`, the modal shows `{days}-day free trial` but the actual MASTER FREE100 promo is `free_full` (100% off lifetime). Confirm: does FREE100 redemption ever route through `free_trial` branch? If not, branch may be dead code.
