# i18n + CardTitle Polish Report — 260503

## Task A: i18n keys

**Keys added: 2 × 2 files = 4 insertions**

- `messages/en.json` — added under `settings.mfa`:
  - `cancel` = "Cancel"
  - `revoking` = "Revoking…"

- `messages/vi.json` — added under `settings.mfa`:
  - `cancel` = "Hủy"
  - `revoking` = "Đang hủy…"

**File edits — `src/app/[locale]/settings/security/mfa/page.tsx`:**
- Line 224: `Cancel` → `{t('cancel')}`
- Line 231: `'Disabling…'` → `t('revoking')`

No `revoking` key was previously wired; the loading text in disable flow was inline `'Disabling…'` — replaced with `t('revoking')`.

## Task B: CardTitle hierarchy

**No `as="h2"` changes applied.** Reason: all 3 section files already use `<SectionHeading>` for the section's primary heading (which renders native `<h2>`). All `<CardTitle>` usages are inside card grids (step cards, feature cards, ROI sub-card) — correctly `h3` by default.

- `workflow.tsx`: 4× `<CardTitle>` inside step card grid → `h3` correct
- `roi-calculator.tsx` line 34: `<CardTitle>` inside single card body (sub-heading) → `h3` correct
- `raas-showcase.tsx` line 75: `<CardTitle>` inside feature card grid → `h3` correct

## TypeScript check

`npx tsc --noEmit` — 4 pre-existing errors in test files (`nowpayments-ipn-dispatch.test.ts`, `complete-video-from-webhook.test.ts`). Zero errors in edited files.

## Summary

Task A: 4 i18n keys added across 2 JSON files; 2 hardcoded strings wired in mfa/page.tsx. Task B: no changes — `SectionHeading` already handles `h2`; no top-level CardTitle found.
