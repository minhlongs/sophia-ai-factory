---
title: "Phase 04 — Admin CRUD Dashboard"
status: completed
priority: P1
effort: 4h
blockedBy: [01, 02]
---

# Phase 04 — Admin CRUD Dashboard

## Context Links
- Plan overview: `./plan.md`
- Phase 01 (repo): `./phase-01-database-migration-and-repository.md`
- Phase 02 (types): `./phase-02-types-config-and-llm-fallback-generator.md`
- Admin layout/auth gate: `src/app/[locale]/dashboard/admin/layout.tsx` (requireMasterTier)
- Admin list page pattern: `src/app/[locale]/dashboard/admin/audit-log/page.tsx` (inline table, force-dynamic)
- Admin edit pattern: `src/app/[locale]/dashboard/admin/pricing/` (server shell + client form)
- Table UI component (optional): `src/seed/components/ui/table.tsx` (Table, TableHeader, etc.)
- Admin components: `src/components/admin/AdminAlertsStrip.tsx`, `src/components/admin/AdminStatsCard.tsx`
- Auth: `requireMasterTier` from `@/seed/auth/require-master-tier`

## Overview
Build the admin dashboard for managing landing pages: a list page showing all niches with publish status, and an edit page with a form for creating/editing/deleting niche content. Follows existing admin patterns (force-dynamic server components, inline tables, requireMasterTier auth gate).

## Key Insights
- **No shared AdminTable component** — each admin page builds its `<table>` inline. Follow this pattern.
- **No shared form library pattern for admin** — existing pages use `'use client'` components with plain `fetch()` calls to API routes. The pricing editor is the closest analogue.
- **Two-layer auth**: `layout.tsx` (top-level gate) + per-page `requireMasterTier()` call (defense-in-depth).
- **API routes for mutations** follow existing pattern: POST/PUT/DELETE to `/api/admin/landing-pages/[slug]`.
- **Bilingual in admin**: labels toggle by `locale.startsWith('vi')`, but admin content entry shows BOTH languages simultaneously (EN fields + VI fields side-by-side, not toggled).
- **JSON fields** (features_json, faq_json): admin form needs a way to edit array items. Simplest approach: textarea with JSON editing for MVP, or structured repeater fields if time permits.
- **Route pattern**: list at `/dashboard/admin/landing-pages`, edit at `/dashboard/admin/landing-pages/[slug]`.
- **Delete pattern**: button with `window.confirm()` guard, same as refunds admin.

## Requirements
### Functional
- List page at `/dashboard/admin/landing-pages` showing all niches in a table
- Table columns: Slug, Niche Label, Published (toggle), Created At, Actions (Edit/Delete)
- Edit page at `/dashboard/admin/landing-pages/[slug]` with full form
- Edit page supports both creating new niches and editing existing ones
- Form fields: slug (readonly on edit), niche_label, hero_title_en, hero_title_vi, hero_sub_en, hero_sub_vi, features_json (textarea), faq_json (textarea), meta_title_en, meta_title_vi, meta_desc_en, meta_desc_vi, is_published (checkbox)
- API routes: GET list, GET by slug, POST create, PUT update, DELETE
- Bulk status toggle from list page (publish/unpublish via fetch)
- New niche creation at `/dashboard/admin/landing-pages/new` (slug input for new niche)

### Non-Functional
- Admin-only access via `requireMasterTier()` — redirect non-MASTER to dashboard
- Zero `:any` types
- Form validation with Zod on API routes
- All mutations via Server Actions or API routes (not direct D1 from client)
- Bilingual admin labels (VI+EN for form labels)
- Follow existing admin page styling (tailwind, shadcn-like, dark mode compatible)

## Architecture

### Route Design
```
app/[locale]/dashboard/admin/landing-pages/
  page.tsx              # List page (server component, force-dynamic)
  loading.tsx           # Loading skeleton
  error.tsx             # Error boundary
  [slug]/
    page.tsx            # Edit/Create page (server shell + client form)
    loading.tsx
    error.tsx

app/api/admin/landing-pages/
  route.ts              # GET list + POST create
  [slug]/
    route.ts            # GET by slug, PUT update, DELETE
```

### Data Flow (List Page)
```
User visits /dashboard/admin/landing-pages
  -> layout.tsx: requireMasterTier() gate
  -> page.tsx: requireMasterTier() defense-in-depth
  -> listAll() from landing-pages-repo
  -> Render inline table with niche rows
  -> Client: fetch() to toggle is_published
```

### Data Flow (Edit Page)
```
User visits /dashboard/admin/landing-pages/real-estate
  -> layout.tsx: requireMasterTier() gate
  -> page.tsx (server): requireMasterTier(), getBySlug('real-estate')
  -> Pass data to ClientForm component
  -> ClientForm: controlled form with all fields
  -> Submit -> fetch PUT /api/admin/landing-pages/real-estate
  -> On success: router.push back to list, or show success toast
```

## Related Code Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/page.tsx` | List page (server component) |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/loading.tsx` | Loading skeleton |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/error.tsx` | Error boundary |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/[slug]/page.tsx` | Edit/Create page (server shell) |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/[slug]/loading.tsx` | Loading skeleton |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/[slug]/error.tsx` | Error boundary |
| CREATE | `src/app/[locale]/dashboard/admin/landing-pages/landing-pages-editor.tsx` | Client form component ('use client') |
| CREATE | `src/app/api/admin/landing-pages/route.ts` | API: GET list, POST create |
| CREATE | `src/app/api/admin/landing-pages/[slug]/route.ts` | API: GET, PUT, DELETE |
| MAYBE | `messages/en.json` | Add admin.landingPages i18n keys |
| MAYBE | `messages/vi.json` | Add admin.landingPages i18n keys |

## Implementation Steps

### Step 1: Create API routes
1. Create `src/app/api/admin/landing-pages/route.ts`
   - `GET`: call `listAll()`, return JSON array
   - `POST`: validate body with Zod (`CreateLandingPageInput`), call `create()`, return created page
2. Create `src/app/api/admin/landing-pages/[slug]/route.ts`
   - `GET`: call `getBySlug(slug)`, return JSON or 404
   - `PUT`: validate body with Zod (`UpdateLandingPageInput`), call `update(slug, data)`, return updated page
   - `DELETE`: call `delete(slug)`, return 200 or 404
3. Auth check in each API route: call `requireMasterTier()` (throws redirect if not MASTER)
4. Use `NextResponse.json()` for responses
5. Error handling: try/catch, return 500 with error message on failure

### Step 2: Create list page
1. Create `src/app/[locale]/dashboard/admin/landing-pages/page.tsx`
2. `export const dynamic = 'force-dynamic'`
3. Server component: `await requireMasterTier()`, `const pages = await listAll()`
4. Render inline `<table>`:
   - thead: Slug, Niche Label, Published, Created At, Updated At, Actions
   - tbody: map pages to rows
   - Actions column: Edit link (`/dashboard/admin/landing-pages/${page.id}`), Delete button (`window.confirm()` + fetch DELETE)
   - Publish toggle: checkbox calling fetch PUT to toggle `is_published`
5. Summary cards row: Total niches, Published count, Unpublished count
6. "New Niche" button linking to `/dashboard/admin/landing-pages/new`
7. Bilingual labels: `const isVi = locale.startsWith('vi')`

### Step 3: Create landing-pages-editor.tsx (client component)
1. Create `'use client'` component at `landing-pages-editor.tsx`
2. Props: `locale: string`, `initialData: LandingPage | null` (null = create mode)
3. State: form fields for all LandingPage properties
4. Features editor: textarea with JSON array (default template for new)
5. FAQ editor: textarea with JSON array (default template for new)
6. Publish checkbox
7. Save button: `fetch()` POST (create) or PUT (update) to API route
8. Delete button (edit mode only): `window.confirm()` + `fetch()` DELETE + redirect to list
9. Success/error state: inline alert banner
10. Form validation: required fields highlighted, JSON parse check on features/faq textareas
11. Bilingual labels: `isVi` gating for field labels, help text

### Step 4: Create edit page (server shell)
1. Create `src/app/[locale]/dashboard/admin/landing-pages/[slug]/page.tsx`
2. Server component: `await requireMasterTier()`, `await params` for slug
3. If slug === 'new': render editor with `initialData={null}`
4. Else: `const page = await getBySlug(slug)`, if null `notFound()`, render editor with data
5. Render `LandingPagesEditor` client component passing `locale` and `initialData`
6. Page title: "Edit [Niche Label]" or "Create New Landing Page"

### Step 5: Create loading and error states
1. `loading.tsx`: skeleton table with animate-pulse rows (follow existing admin loading patterns from audit-log or cost)
2. `error.tsx`: error message with retry button (follow existing admin error pattern)

### Step 6: Add i18n keys (optional, can hardcode labels for MVP)
1. Add `admin.landingPages` section to `messages/en.json`
2. Add `admin.landingPages` section to `messages/vi.json`
3. Keys: title, slug, nicheLabel, hero, features, faq, meta, published, actions, save, delete, create, etc.

### Step 7: Verify
1. Run `npm run type-check` — zero errors
2. Run `npm run build` — admin pages compile
3. Manual test: visit list page, create niche, edit, delete, toggle publish

## Todo List
- [ ] Create `src/app/api/admin/landing-pages/route.ts` (GET list, POST create)
- [ ] Create `src/app/api/admin/landing-pages/[slug]/route.ts` (GET, PUT, DELETE)
- [ ] Create list page `landing-pages/page.tsx` with inline table
- [ ] Create `landing-pages-editor.tsx` client form component
- [ ] Create edit page `landing-pages/[slug]/page.tsx` server shell
- [ ] Create loading.tsx and error.tsx for both pages
- [ ] Add i18n keys for admin labels (or use inline bilingual strings)
- [ ] Verify `npm run type-check` and `npm run build` pass
- [ ] Manual test: full CRUD cycle

## Success Criteria
- List page shows all landing pages with publish status and action buttons
- Edit page allows editing all fields including JSON arrays
- Create flow works for new niches (via `/new` slug)
- Delete with confirmation guard removes niche from D1
- Publish toggle updates `is_published` instantly
- API routes validate input with Zod, reject invalid data
- All pages require MASTER tier (redirect on unauthorized)
- Zero TypeScript errors

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| JSON textarea editing is error-prone | Medium | Medium | Validate JSON.parse on blur; show inline parse error; structured editor as future enhancement |
| Admin CRUD conflicts with build-time SSG (Phase 03) | Low | Low | SSG builds from D1 at build time; admin changes take effect on next build or via ISR revalidation |
| Delete removes niche from SSG until next build | Medium | Low | Unpublish instead of delete (soft delete); document that delete requires rebuild |
| API route auth bypass | Low | High | `requireMasterTier()` in every API route handler (throws redirect, not return 401) |

## Security Considerations
- All admin pages and API routes gated behind `requireMasterTier()` — redirects non-MASTER users
- API routes validate input with Zod schemas from Phase 02 (`CreateLandingPageInput`, `UpdateLandingPageInput`)
- Delete is destructive — confirmation dialog required; consider soft-delete (unpublish) for safety
- No PII in landing page content — public marketing copy only
- JSON injection: sanitize features_json and faq_json — Zod ensures valid shape, no script injection possible in text-only fields

## Next Steps
- After all phases complete: integration test (full flow: admin creates niche -> builds SSG -> page renders -> LLM fallback for unknown slug)
- Consider future enhancements: structured features/FAQ editor (repeatable fields instead of JSON textarea), bulk import/export, A/B testing for landing page variants
