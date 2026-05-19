# Track C — A11y Deep Dive + Responsive Audit (Sophia /dashboard)

Date: 2026-05-18. Scope: `src/app/[locale]/dashboard/**`, `src/forest/components/dashboard/**`, `src/seed/components/ui/**`. Read-only.

## §1 Focus States

Primitive `Button` (seed/components/ui/button.tsx:7) has `focus-visible:ring-1 focus-visible:ring-ring` — passes. But many dashboard buttons are bare `<button>` not using primitive — focus rings only present on explicit additions.

| Sample | File:Line | Focus ring? |
|---|---|---|
| Sidebar nav `<Link>` | dashboard/layout.tsx:139-200 | ❌ no `focus-visible:` |
| MobileNav `<Link>` | seed/components/ui/mobile-nav.tsx:35 | ❌ no focus-visible |
| Handover wizard Back/Next | handover-wizard-client.tsx:151,157,161 | ❌ no focus-visible |
| Banner dismiss | handover-onboarding-banner.tsx:115 | ❌ no focus |
| Help video close | help/help-video-player.tsx:61 | ✅ `focus:ring-2` |

Verdict: ~70% of sampled interactive elements lack explicit focus ring; browser default may show on Chromium but Safari often removes — fails WCAG 2.4.7.

## §2 ARIA on Icon-only Buttons

Sampled 10 icon-only buttons:

- `handover-onboarding-banner.tsx:115` `<button><X size={16}/></button>` — **NO aria-label**
- `cross-sell-banner.tsx:81` — has aria-label ✅
- `master-welcome-banner.tsx:68` `<X>` — needs check (has surrounding text? — inspected: text-only context, X is icon-only) **NO aria-label**
- `onboarding-welcome-banner.tsx:48` — **NO aria-label**
- `onboarding-tour/tour-overlay.tsx:63` — **NO aria-label**
- `campaign-export-control.tsx:85` — wraps text "Close" via JSX? — needs verify, likely missing
- `help/help-video-player.tsx:68` ✅ aria-label
- `handover/list/handover-list-client.tsx:190` ChevronUp/Down expand toggle — **NO aria-label**

Total aria-label hits in dashboard tree: 41. Estimated icon-only buttons: ~20-25 → ~50% missing aria-label.

## §3 Form Labels (5 routes sampled)

| Route | Pattern | htmlFor? |
|---|---|---|
| settings/branding/branding-form-client.tsx:242 | sibling `<label>` + `<input>` no id | ❌ |
| settings/branding/email-branding-form.tsx:61 | same | ❌ |
| settings/customize/customize-page-client.tsx:113 | same | ❌ |
| admin/handover/handover-wizard-steps.tsx:60 | `Field` wrapper, sibling label | ❌ |
| admin/tenant-lookup/page.tsx:88 | search input no label | ❌ (placeholder only) |

Codebase counts: 21 `htmlFor=` usages vs ~66 input/select/textarea instances. **~68% of form fields lack programmatic label association**. Screen readers will not announce label-field pair. Placeholder-as-label anti-pattern present in tenant-lookup.

## §4 Image Alt Text

3 image refs found in dashboard:
- `branding/branding-image-uploader.tsx:62` `<img alt={kind}>` — `kind` is enum like "logo"/"favicon", meaningful enough but not localized
- `videos/components/video-gallery.tsx:97` `alt={video.title ?? t("untitled")}` — ✅ excellent fallback
- `help/help-videos-library.tsx:43` — needs verify

Verdict: pass (low image footprint; alt present on all sampled).

## §5 Touch Target Size

Primitive Button sizes (button.tsx:25-32):
- `default` h-9 = **36px** ❌
- `sm` h-8 = **32px** ❌
- `lg` h-10 = **40px** ❌
- `icon` h-9 w-9 = **36×36** ❌
- `md` h-11 = 44px ✅
- `xl` h-14 = 56px ✅

**Default and most-used sizes fail 44×44 WCAG 2.5.5 AAA / Apple HIG**.

Banner close buttons (`p-1.5` + 16px icon) = **28×28** ❌. Sidebar links `px-4 py-3` ≈ 44-48px ✅. MobileNav `h-16` / item ≈ 64×75 ✅.

## §6 Viewport Meta

`src/app/[locale]/layout.tsx:103-108`:
```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};
```
✅ Present, correct. `maximumScale: 5` allows pinch-zoom (good; avoids `user-scalable=no` anti-pattern).

## §7 Horizontal Scroll Risks

11 `<table>` instances in admin/. 9 have `overflow-x-auto` wrapper.

**Missing wrapper** (will overflow on 375px viewport):
- `admin/pricing/admin-pricing-editor.tsx:59-60` — wrapped only by `rounded-xl border overflow-hidden` (overflow-hidden CLIPS, doesn't scroll → cuts off content)
- `admin/cost/page.tsx:174` — 2nd table inside same page lacks wrapper (1st has it line 105)
- `analytics/components/agent-performance-card.tsx:141` — wrapped ✅

## §8 z-index Findings

15 z-index usages in dashboard/forest/seed. All use Tailwind scale (z-10/20/30/40/50). **No arbitrary `z-[9999]` hacks** — passes.

Recommended scale doc (currently undocumented):
```
z-10  — sticky elements, sidebar quota widget
z-20  — overlays under nav
z-30  — sticky table headers
z-40  — dropdowns, popovers
z-50  — modals, mobile-nav bar, tour overlay (current)
```

## §9 Reduced Motion

14 usages of `motion-safe:` prefix across `forest/components/**`. All `animate-spin` / `animate-pulse` gated behind `motion-safe:`. ✅ Passes WCAG 2.3.3.

`globals.css` not inspected here — if any raw `@keyframes` animations run without `@media (prefers-reduced-motion: reduce)`, that would be a gap (likely none given motion-safe discipline).

## §10 Keyboard Nav — Handover Wizard

`handover-wizard-client.tsx`:
- Step indicator: text-only, no buttons → can't jump steps via keyboard (limitation, not a11y bug if linear-only is intent)
- Back/Next/Generate buttons (lines 151/157/161): sequential DOM order matches visual — tab works ✅
- `disabled` state on Generate uses `disabled` attribute ✅
- **Missing:** `aria-current="step"` on active step indicator; no `role="progressbar"` or step labels for screen reader
- Step 2 SOP checkboxes use `<label>` wrapping `<input>` (line 141-145) ✅ — proper association

## §11 Top 5 Ranked Issues

| # | Issue | Severity | Fix LOC |
|---|---|---|---|
| 1 | **Form label association broken** (~68% of inputs lack `htmlFor`/`id`) | HIGH (WCAG 1.3.1, 3.3.2 — blocks screen readers) | ~80 LOC across 10 files |
| 2 | **Touch targets below 44px** (default Button h-9, banner close buttons p-1) | HIGH (mobile UX, WCAG 2.5.5) | 3 LOC (button.tsx) + 5 banner files |
| 3 | **Missing focus rings** on sidebar nav, MobileNav, wizard buttons | HIGH (WCAG 2.4.7) | ~15 LOC across 4 files |
| 4 | **Icon-only buttons lack aria-label** (~50% of close/expand buttons) | MEDIUM (WCAG 4.1.2) | ~20 LOC across 6 files |
| 5 | **Tables overflow on mobile** (pricing-editor, cost 2nd table) | MEDIUM (responsive, WCAG 1.4.10) | 4 LOC across 2 files |

## §12 Three Concrete Refactor Proposals

### P1 — Fix Button primitive default touch target

`src/seed/components/ui/button.tsx:25-32` (3 LOC change):
```diff
       size: {
-        default: "h-9 px-4 py-2",
-        sm: "h-8 rounded-md px-3 text-xs",
-        lg: "h-10 rounded-md px-8",
-        icon: "h-9 w-9",
+        default: "h-11 px-4 py-2",        // 44px
+        sm: "h-9 rounded-md px-3 text-xs", // 36px — explicit compact
+        lg: "h-12 rounded-md px-8",        // 48px
+        icon: "h-11 w-11",                 // 44×44
         md: "h-11 px-6 text-base",
         xl: "h-14 px-8 text-lg",
       },
```
Note: this is a visual change — sweep all `Button` usages for layout regressions before shipping.

### P2 — Fix Field component to use proper label association

`src/app/[locale]/dashboard/admin/handover/handover-wizard-steps.tsx:57-63` (≤10 LOC):
```diff
-export function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
-  return (
-    <div className="space-y-1.5">
-      <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">{icon}{label}</label>
-      {children}
-    </div>
-  );
-}
+export function Field({ id, icon, label, children }: { id?: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
+  const fieldId = id ?? React.useId();
+  return (
+    <div className="space-y-1.5">
+      <label htmlFor={fieldId} className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">{icon}{label}</label>
+      {React.cloneElement(children as React.ReactElement, { id: fieldId })}
+    </div>
+  );
+}
```
Pattern propagable to all sibling-label forms.

### P3 — Wrap admin pricing table for horizontal scroll

`src/app/[locale]/dashboard/admin/pricing/admin-pricing-editor.tsx:59` (2 LOC):
```diff
-    <div className="rounded-xl border border-zinc-800 overflow-hidden">
-      <table className="w-full text-sm">
+    <div className="rounded-xl border border-zinc-800 overflow-x-auto">
+      <table className="w-full min-w-[640px] text-sm">
```
`overflow-hidden` cuts content on mobile; `overflow-x-auto` + `min-w` lets users scroll horizontally.

## §13 Unresolved Questions

1. Sidebar quota widget uses `text-[11px]` and `text-[10px]` (mobile-nav) — below readable-font-size guideline. Intentional metadata size? If user has 200% zoom, will it remain legible?
2. `globals.css` not inspected — any global `@keyframes` outside `motion-safe:` discipline?
3. Handover wizard step indicator is text-only; should it become button-list with `aria-current="step"` to enable jump-to-step?
4. `axe-core/playwright` only ran 1 violation on PROD before fix — was the test suite running on representative sample? (recommend expanding to all admin/* routes)
5. Pricing editor `overflow-hidden` may be intentional (no scroll desired) — confirm with product before flipping to `overflow-x-auto`.
6. Many bare `<button>` elements in dashboard could be migrated to primitive `Button` — would propagate focus-visible automatically; worth a sweep.
