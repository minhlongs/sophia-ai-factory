## 2026-05-30T09:26:57Z

Fix all identified bugs and quality issues in the SOP Dashboard (Bảng điều khiển SOPs) of a Next.js 15 project. This is a pre-handover quality sweep — no new features, only bug fixes and consistency improvements. The CEO needs this clean before accepting the product.

Working directory: /Users/macbook/projects/sophia-ai-factory
Integrity mode: development

## Requirements

### R1. Fix hardcoded English strings in SOP Creator Dashboard

The file `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx` has many hardcoded English strings that should use `next-intl` translations:
- Line 94: `"Creator Dashboard"` (h1 title)
- Line 95: `"Manage your SOP templates and earnings"` (subtitle)
- Line 103: `"Create New SOP"` (button)
- Line 110-113: Earnings card labels ("Total Earned", "Pending", "Payable", "Paid Out")
- Line 129: `"Your SOPs"` (section header)
- Line 135: `"No SOPs yet"` (empty state)
- Line 136: `"Create your first SOP template to start earning"` (empty state description)
- Line 142: `"Create First SOP"` (empty CTA)
- Line 150-154: Table headers ("Name", "Category", "Status", "Sales", "Revenue")

Replace all with `getTranslations('sop.creator')` calls (this is a Server Component), adding the corresponding keys to the English and Vietnamese translation files (`messages/en.json` and `messages/vi.json`). Maintain the same visual appearance.

### R2. Fix hardcoded English in SOP Marketplace first-time callout

In `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx`, lines 84-89 use inline `isVi ? 'Vietnamese' : 'English'` ternary patterns instead of proper translation keys. Replace with `getTranslations('sop.marketplace')` calls and add translation keys.

Also in `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx` (FirstSopCallout component, lines 87-103), same pattern — hardcoded bilingual ternary. Replace with translations.

### R3. Fix duplicate `category-badge.test.tsx` test file

There are TWO test files for CategoryBadge:
- `src/forest/components/sop/category-badge.test.tsx` (root level — wrong location)
- `src/forest/components/sop/__tests__/category-badge.test.tsx` (correct location)

Delete the duplicate at root level (`category-badge.test.tsx`), keeping only the `__tests__/` version. Verify tests still pass.

### R4. Fix N+1 query pattern in SOP list page

In `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx`, lines 50-55:
```typescript
const withTemplates = await Promise.all(
  installations.map(async (inst) => {
    const template = db ? await getTemplateById(db, inst.template_id) : null;
    return { ...inst, template };
  }),
);
```

This fires N individual `SELECT` queries for each installation's template. Replace with a single batch query using `WHERE id IN (...)` pattern. Either:
- Add a `getTemplatesByIds(db, ids: string[])` function to `sop-repo-templates.ts`, or
- Use a single `db.prepare('SELECT * FROM sop_templates WHERE id IN (...)').bind(...)` call inline.

### R5. Add missing error handling for `getD1()` null cases

The SOP marketplace page (`sop-marketplace/page.tsx`) calls `listOfficialTemplates(db)` etc. with a possibly-null `db`, using ternary fallbacks. But the SOP creator page (`sop-creator/page.tsx`, line 71-77) also does this but with less protection — if `db` is null, `fetchEarnings` receives `null` as the second arg. Add an early `if (!db)` guard that shows a user-friendly error state or redirects, consistent with how `sops/[id]/page.tsx` handles it (line 42: `if (!db) notFound()`).

### R6. Add missing SOP creator detail page

The SOP creator table links to `/dashboard/sop-creator/${t.id}` (line 164) but there is NO `[id]/page.tsx` route inside `sop-creator/`. This means clicking any SOP in the creator table leads to a 404. At minimum, create a placeholder page that shows the template details and a "Submit for Review" button, or redirect to the marketplace detail page if the template is published.

### R7. Add `submitForReviewAction` button to SOP creator flow

The `submitForReviewAction` exists in `sop-creator/actions.ts` (line 72) but is never called from any UI component. Wire it into the creator detail page (from R6) or the creator list page with a "Submit for Review" button for templates in `draft` status.

## Acceptance Criteria

### Translation completeness
- [ ] Zero hardcoded English user-facing strings remain in SOP creator dashboard page
- [ ] Zero hardcoded English user-facing strings remain in SOP marketplace first-time callout
- [ ] Zero hardcoded English user-facing strings remain in SOP list FirstSopCallout component
- [ ] Both `messages/en.json` and `messages/vi.json` contain all new `sop.creator.*` and updated `sop.marketplace.*` keys
- [ ] Vietnamese translations are natural Vietnamese (not Google Translate quality)

### Code quality
- [ ] Duplicate `category-badge.test.tsx` at root level is deleted
- [ ] N+1 query in SOP list page is replaced with batch query
- [ ] All `getD1()` null cases have explicit handling (no undefined passed to functions)
- [ ] SOP creator detail route (`/dashboard/sop-creator/[id]`) exists and renders without crash

### No regressions
- [ ] All existing SOP-related tests pass: `npx vitest run src/forest/components/sop/ src/lib/sop/`
- [ ] TypeScript compiles without errors in changed files: `npx tsc --noEmit 2>&1 | grep -i sop` returns empty
- [ ] `submitForReviewAction` is wired to a UI button and changes template status to `published`
