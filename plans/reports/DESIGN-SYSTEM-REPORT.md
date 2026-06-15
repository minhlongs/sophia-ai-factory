# Design System Implementation Report

**Date**: 2026-06-16  
**Scope**: Unify UI component usage and enforce design tokens across Sophia AI Factory  
**Audit Reference**: FE-ARCHITECTURE-AUDIT.md (section 5: UI Inconsistencies, section 8: Design System Gaps)

---

## 1. Components Created

### Missing Components Added to `src/seed/components/ui/`

| Component | Path | Description |
|-----------|------|-------------|
| **Breadcrumb** | `src/seed/components/ui/breadcrumb.tsx` | Breadcrumb navigation with `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`. Uses Radix UI Slot and ChevronRight icon. |
| **Pagination** | `src/seed/components/ui/pagination.tsx` | Pagination controls with `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`. Integrated with Button component. |

### Barrel Export

Created `src/seed/components/ui/index.ts` to re-export all UI components (primitives + composite) for convenient imports.

**Note**: The following components already existed in the design system and were verified:
- `table.tsx` (shadcn-compatible, semantic `<table>`)
- `tabs.tsx` (Radix UI Tabs)
- `select.tsx` (Radix UI Select)
- `form.tsx` (Server Action wrapper)
- `label.tsx`, `input.tsx`, `button.tsx`, `card.tsx`, etc.

---

## 2. Arbitrary Tailwind Value Replacement

### Strategy
Replaced non-token arbitrary values with standard Tailwind classes or existing CSS variables. Focused on the most frequent patterns to reduce noise.

### Mapping Decisions

| Arbitrary Value | Replacement | Rationale |
|-----------------|-------------|-----------|
| `rounded-[16px]` | `rounded-2xl` | Exact pixel match (16px = 1rem). Tailwind `rounded-2xl` is 1rem. |
| `text-[9px]` | `text-xs` | No exact token; `text-xs` is 12px, slightly larger but acceptable and more accessible. |
| `text-[10px]` | `text-xs` | Same as above. |
| `text-[11px]` | `text-xs` | Same as above. |
| `text-[var(--neon-cyan)]` | kept | This uses a CSS variable, which is a design token; no change needed. |
| `bg-[#1a1a1a]` | none found | Audit listed 386+ hits, but current codebase had 0 hits for hex colors; already cleaned up. |
| `p-[calc(1rem-2px)]` | none found | No occurrences in current code. |

### Files Modified (Arbitrary Values)

1. `src/app/components/sections/features.tsx` — replaced 2× `rounded-[16px]` with `rounded-2xl`
2. `src/app/components/sections/creative-studio-showcase.tsx` — replaced 2× `rounded-[16px]` with `rounded-2xl`
3. `src/app/components/sections/social-proof-testimonials.tsx` — replaced 1× `rounded-[16px]` with `rounded-2xl`
4. `src/app/[locale]/dashboard/creative-studio/components/video-creator-tab.tsx` — replaced multiple `text-[9px]`, `text-[10px]` with `text-xs`
5. `src/app/[locale]/dashboard/creative-studio/components/script-preview-panel.tsx` — replaced `text-[10px]`, `text-[11px]` with `text-xs`
6. `src/app/[locale]/dashboard/components/local-setup-guide.tsx` — replaced `text-[10px]`, `text-[11px]` with `text-xs`
7. `src/forest/components/pricing/pricing-card.tsx` — replaced 4× `text-[9px]` with `text-xs`
8. `src/forest/components/byok/byok-key-form.tsx` — replaced 3× `text-[10px]` with `text-xs`
9. `src/app/[locale]/dashboard/integrations/integration-card.tsx` — replaced 3× `text-[10px]` with `text-xs`
10. `src/app/[locale]/dashboard/creative-studio/components/video-script-template-selector.tsx` — replaced 3× `text-[10px]` with `text-xs`
11. `src/forest/components/discovery/product-card.tsx` — replaced 2× `text-[10px]` with `text-xs`

**Total replacements**: ~30+ occurrences across 11 files.

---

## 3. Pages Updated to Use Design System Table

Converted custom table implementations to use `@/seed/components/ui/table`.

| Page | Changes |
|------|---------|
| `/dashboard/wallet/page.tsx` | Replaced custom `<table>` with `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableHead>`, `<TableCell>`. Preserved styling via className overrides where needed (e.g., `text-xs uppercase` on headers, custom `text-[var(--neon-cyan)]` for commission). |
| `/dashboard/admin/invites/page.tsx` | Replaced custom table with design system Table. Kept dark-mode text colors (`text-white/60`, etc.) via className overrides on cells. |
| `/dashboard/admin/tenant-lookup/page.tsx` | Replaced custom table in the recent audit section with design system Table. Removed redundant `overflow-x-auto` wrapper (Table provides its own). |

**Total pages converted**: 3 (meets "at least 3" requirement).

---

## 4. ESLint Rule for Design System Enforcement

**Status**: Not implemented (P2 optional).  
**Reason**: Simpler approach via documentation and gradual adoption is sufficient for now. The codebase already has strong linting; adding custom ESLint rules can be considered in a later phase if adoption lags.

**Recommendation**: If pursued later, use `eslint-plugin-tailwindcss` with `tailwindcss/recommended` and custom rule to flag arbitrary values or encourage component usage.

---

## 5. Documentation Update

**File**: `apps/sophia-ai-factory/docs/code-standards.md`

Added new section **"Design System Usage"** under Coding Conventions (after Styling) covering:

- Available components list
- Import patterns
- When to use design system vs custom Tailwind
- Button variant standardization
- Arbitrary value replacement guidelines
- Adoption strategy

---

## 6. Verification

✅ **Build**: `npm run build` completed successfully with 0 TypeScript errors.  
✅ **Tests**: `npm test` passed 5750 tests (34 skipped).  
✅ **i18n validation**: All translation keys present.

---

## 7. Token Mapping Decisions Summary

- **Rounded corners**: Arbitrary pixel values mapped to nearest Tailwind scale (`rounded-2xl` for 16px).
- **Font sizes**: Small arbitrary sizes (`9px`, `10px`, `11px`) mapped to `text-xs` (12px). Improves accessibility with minimal visual impact.
- **Colors**: CSS variables (`var(--neon-cyan)`) retained as they represent design tokens.
- **Spacing**: No arbitrary padding `p-[calc(...)]` encountered; no changes needed.

---

## 8. Next Steps / Unresolved

- **Further table migrations**: Additional custom tables exist in admin pages (audit-log, cost, storage, webhook-deliveries, etc.). Consider migrating in future pass.
- **Button variant consistency**: Audit found inconsistent button usage across some pages. Not fully standardized; could be a follow-up task.
- **ESLint rule**: Optional enhancement to auto-flag arbitrary Tailwind values and prefer design system components.

---

## Files Modified Summary

**New Files**:
- `src/seed/components/ui/breadcrumb.tsx`
- `src/seed/components/ui/pagination.tsx`
- `src/seed/components/ui/index.ts`

**Updated Files** (UI components + pages + docs):
- `docs/code-standards.md`
- `src/app/[locale]/dashboard/wallet/page.tsx`
- `src/app/[locale]/dashboard/admin/invites/page.tsx`
- `src/app/[locale]/dashboard/admin/tenant-lookup/page.tsx`
- `src/app/components/sections/features.tsx`
- `src/app/components/sections/creative-studio-showcase.tsx`
- `src/app/components/sections/social-proof-testimonials.tsx`
- `src/app/[locale]/dashboard/creative-studio/components/video-creator-tab.tsx`
- `src/app/[locale]/dashboard/creative-studio/components/script-preview-panel.tsx`
- `src/app/[locale]/dashboard/components/local-setup-guide.tsx`
- `src/forest/components/pricing/pricing-card.tsx`
- `src/forest/components/byok/byok-key-form.tsx`
- `src/app/[locale]/dashboard/integrations/integration-card.tsx`
- `src/app/[locale]/dashboard/creative-studio/components/video-script-template-selector.tsx`
- `src/forest/components/discovery/product-card.tsx`

**Total files touched**: 15 updated + 3 new.

---

## Conclusion

The design system has been enriched with two missing components (Breadcrumb, Pagination), arbitrary Tailwind values have been significantly reduced, and three key pages now use the unified Table component. Documentation now guides developers toward consistent patterns. Build and tests pass, confirming no regressions.
