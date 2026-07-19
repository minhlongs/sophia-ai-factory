# Phase 03 — SOP Marketplace Browse + Install UI

## Context Links

- Plan: [./plan.md](./plan.md)
- Depends: Phase 01 (templates seeded), Phase 02 (HMAC secret + run engine — for install API to provision webhook secret)
- Existing dashboard pattern: `apps/sophia-ai-factory/src/app/[locale]/dashboard/byok/page.tsx`, `.../campaigns/page.tsx`
- Existing locale strings: `apps/sophia-ai-factory/src/i18n/messages/{en,vi}.json` (verify path)
- Existing UI primitives: `apps/sophia-ai-factory/src/components/ui/*` (shadcn-style)

## Overview

- Priority: P1
- Status: pending
- Effort: 16h
- Description: Customer-facing marketplace pages — list of 5 official SOPs as cards, detail page with description + sample output + install modal. APIs to list, fetch, install, toggle, delete user installations. Bilingual Vi+En.

## Key Insights

- Pages live under `[locale]/dashboard/sop-marketplace/` to inherit locale + auth layout.
- Server Components for read pages (data on server via repo), Client Components for modals + install button.
- Install action = Server Action (per Sophia rules: "Server Actions for data mutations").
- "Customize before installing" = show editable Markdown preview; default = use template as-is.
- Cards bilingual: surface `name_vi`/`name_en` based on locale; description likewise.
- Use existing nav pattern — add "Marketplace" link in dashboard sidebar nav.

## Requirements

### Functional
- F1: `GET /sop-marketplace` lists official + (future) user's published — Phase 1 only official.
- F2: Filter by category dropdown (content/leads/email/analytics/proposals/crisis) + search-by-name.
- F3: `GET /sop-marketplace/[slug]` shows detail (description, agents preview, playbook preview read-only, output schema preview, credits/run, install button).
- F4: Install modal collects: optional cron schedule (preset chips: hourly/daily-9am/weekly-mon-9am/manual-only), enabled-on-install toggle, optional customizations (skip in this phase — defer edit to Phase 04).
- F5: API routes: `GET /api/sop/templates`, `GET /api/sop/templates/[slug]`, `POST /api/sop/install`, `DELETE /api/sop/installations/[id]`, `PATCH /api/sop/installations/[id]/toggle`.
- F6: After install → toast + redirect to `/dashboard/sops/[id]` (page built in Phase 04, but route exists).

### Non-Functional
- All UI files ≤200 LOC.
- Zero `:any`.
- Vi+En via next-intl; new keys added to both message files.
- Mobile responsive (existing breakpoints).
- No client-side fetch of secret data (webhookSecret never sent to browser).

## Architecture

```
[Customer Browser]
  /dashboard/sop-marketplace        ← Server Component, lists templates
  /dashboard/sop-marketplace/[slug] ← Server Component + Client install modal
        │
        ▼ Server Action installSop({slug, cron, enabled})
              ├─ getCurrentUser()
              ├─ getTemplateBySlug(db, slug)
              ├─ generateWebhookSecret() (crypto.randomBytes(32) hex)
              ├─ createInstallation(db, {userId, templateId, customizations: {webhookSecret, vars}, cron, enabled})
              ├─ revalidatePath('/dashboard/sops')
              └─ redirect(`/dashboard/sops/${id}`)
```

## Related Code Files

### Create — Pages
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx` — list (server)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/[slug]/page.tsx` — detail (server)
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/loading.tsx` — skeleton

### Create — Components
- `apps/sophia-ai-factory/src/components/sop/sop-card.tsx` — card with category badge, credits, install button (client)
- `apps/sophia-ai-factory/src/components/sop/sop-filters.tsx` — category dropdown + search input (client)
- `apps/sophia-ai-factory/src/components/sop/sop-install-modal.tsx` — modal with schedule chips (client)
- `apps/sophia-ai-factory/src/components/sop/sop-preview.tsx` — read-only Markdown render (client; uses `react-markdown` if not present, install if missing)
- `apps/sophia-ai-factory/src/components/sop/category-badge.tsx` — small reusable badge

### Create — Server Actions + APIs
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/actions.ts` — `installSopAction`, `toggleSopAction`, `deleteSopAction` (`'use server'`)
- `apps/sophia-ai-factory/src/app/api/sop/templates/route.ts` — GET list
- `apps/sophia-ai-factory/src/app/api/sop/templates/[slug]/route.ts` — GET detail
- `apps/sophia-ai-factory/src/app/api/sop/install/route.ts` — POST (parity with Server Action; for SDK callers)
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/route.ts` — DELETE
- `apps/sophia-ai-factory/src/app/api/sop/installations/[id]/toggle/route.ts` — PATCH

### Create — Validation
- `apps/sophia-ai-factory/src/lib/sop/install-input-schema.ts` — Zod schema `{ slug, scheduleCron?, enabled, customizations? }`

### Modify
- `apps/sophia-ai-factory/src/i18n/messages/en.json` — add `sop.*` keys
- `apps/sophia-ai-factory/src/i18n/messages/vi.json` — same keys, Vi
- Dashboard nav component (find via grep `dashboard/page` or sidebar) — add "Marketplace" + "My SOPs" links

## Implementation Steps

1. **i18n keys** — add to both messages:
   ```json
   "sop": {
     "marketplace": { "title": "...", "filterCategory": "...", "searchPlaceholder": "...", "noResults": "..." },
     "card": { "creditsPerRun": "{n} credits/run", "install": "Install", "installed": "Installed" },
     "detail": { "agentsTitle": "Agents", "playbookTitle": "Playbook", "outputTitle": "Output Schema", "back": "Back" },
     "install": { "title": "Install SOP", "schedule": "Schedule", "scheduleHourly": "Every hour", "scheduleDaily": "Daily 9 AM", "scheduleWeekly": "Weekly Monday 9 AM", "scheduleManual": "Manual only", "enable": "Enable now", "submit": "Install", "success": "Installed!" },
     "categories": { "content": "Content", "leads": "Leads", "email": "Email", "analytics": "Analytics", "proposals": "Proposals", "crisis": "Crisis PR" }
   }
   ```
2. **Zod schema** for install:
   ```ts
   export const installInputSchema = z.object({
     slug: z.string().min(1).max(120),
     scheduleCron: z.string().regex(/^[\*\d\/,\-\s]+$/).max(64).optional(),
     enabled: z.boolean().default(true),
   });
   ```
3. **Server Action** `installSopAction(formData)`:
   - Auth via `getCurrentUser()`.
   - Validate via Zod.
   - `getTemplateBySlug` → 404 if missing.
   - Generate `webhookSecret = crypto.randomBytes(32).toString('hex')` (encrypt at rest using existing `lib/crypto/aes-gcm`).
   - `createInstallation` with customizations JSON `{ webhookSecret: enc, vars: {} }`.
   - `revalidatePath('/dashboard/sops')`.
   - Return `{installationId}` for client redirect.
4. **API parity** — `/api/sop/install/route.ts` reuses same logic for SDK/external callers (Bearer token).
5. **List page**:
   ```tsx
   export default async function MarketplacePage({ searchParams }: Props) {
     const user = await getCurrentUser(); if (!user) redirect('/login');
     const db = createServerClient();
     const templates = await listOfficialTemplates(db);
     const installed = new Set((await listInstallationsForUser(db, user.id)).map(i => i.templateId));
     const filtered = applyFilters(templates, searchParams);
     return <Grid>{filtered.map(t => <SopCard key={t.id} template={t} alreadyInstalled={installed.has(t.id)} />)}</Grid>;
   }
   ```
6. **Detail page**:
   - Server fetch template + render agents (parsed YAML pretty-print) + playbook MD via `<SopPreview>` + output schema (JSON pretty).
   - Pass to `<SopInstallModal>` (client) with `installAction` prop bound to Server Action.
7. **SopCard** client component — bilingual strings via `useTranslations('sop.card')`. Disable install button if `alreadyInstalled`. Click opens modal (state lifted to parent or use shadcn Dialog imperative API).
8. **SopInstallModal** — schedule chip group (4 chips), enabled toggle. Submit calls Server Action via `useFormState`/`useFormStatus`.
9. **DELETE / PATCH toggle endpoints** — auth + ownership check (`installation.userId === user.id`) → call repo. Return `{ok:true}`.
10. **Add dashboard nav** — locate sidebar component (likely in `src/components/dashboard/sidebar.tsx` or layout) and add 2 links: `/dashboard/sop-marketplace` + `/dashboard/sops`.
11. **Tests**:
    - Unit: `installInputSchema.test.ts` — valid + invalid cases.
    - Integration: `api/sop/install.test.ts` (Hono/Next test pattern existing in repo) — happy + duplicate slug + bad cron.
    - Component snapshot for SopCard (Vi + En render).
    - E2E (if Playwright present): browse marketplace → click card → install daily-content-factory → assert redirect.

## Todo List

- [ ] Add i18n keys (Vi + En)
- [ ] install-input-schema.ts (Zod)
- [ ] Server Action installSopAction + toggleSopAction + deleteSopAction
- [ ] /api/sop/templates GET + test
- [ ] /api/sop/templates/[slug] GET + test
- [ ] /api/sop/install POST + test
- [ ] /api/sop/installations/[id] DELETE + test
- [ ] /api/sop/installations/[id]/toggle PATCH + test
- [ ] components/sop/category-badge.tsx
- [ ] components/sop/sop-card.tsx
- [ ] components/sop/sop-filters.tsx
- [ ] components/sop/sop-preview.tsx (install react-markdown if missing)
- [ ] components/sop/sop-install-modal.tsx
- [ ] page.tsx marketplace list
- [ ] [slug]/page.tsx detail
- [ ] loading.tsx skeleton
- [ ] Add Marketplace + My SOPs nav links
- [ ] Verify mobile breakpoints
- [ ] `npm run build` clean

## Success Criteria

- Marketplace shows 5 cards in correct locale.
- Filter by category narrows results; search by name works.
- Click card → detail page renders agents + playbook + schema in <1s.
- Install flow: 3 clicks max (card → install → confirm). Toast on success.
- Re-installing same template either blocked (already installed badge) OR creates 2nd installation (decision: ALLOW multiple installs of same template — confirm with CEO; default behavior: allow).
- All API routes return 401 without auth, 403 on cross-user access.
- Build clean, typecheck clean, no `:any`, no `console.log`.

## Risk Assessment

- R1: `react-markdown` adds bundle weight. Measured ~25KB gz with `remark-gfm` — acceptable. If too heavy, use simpler `<pre>` renderer for read-only previews.
- R2: Cron string validation — Zod regex is loose. Mitigation: validate against preset chip values server-side; reject arbitrary cron strings in Phase 1 (whitelist 4 presets).
- R3: Server Action body size + redirect from action — Next.js 15+ supports; verify pattern by reading existing Server Action in `byok/actions.ts` or similar.

## Security Considerations

- All API routes require `getCurrentUser()`; ownership enforced on installation mutations.
- `webhookSecret` encrypted at rest, never returned in API responses (separate "show secret" flow with re-auth, deferred to Phase 04 if needed).
- Zod validation rejects malformed slugs / cron / category.
- CSRF — Server Actions inherit Next.js built-in protection; API routes Bearer-token authenticated (existing pattern).
- Rate limit `/api/sop/install` via existing rate-limit wrapper (find `lib/rate-limit` or `with-rate-limit` HOC).

## Next Steps

- Phase 04 builds installation detail + edit + run history pages.
- Phase 05 surfaces marketplace + run-this-sop in Cmd+K palette.

## Open Questions

- Allow multiple installs of same template per user? Default: YES (use cases differ by schedule). Confirm CEO. UI shows count of installs per template.
- Cron schedule presets fixed at 4 OR custom field? Phase 1 = fixed 4 presets to limit edge cases.
- Should detail page show "live preview" of expected output from sample run? Defer to Phase 04 (run history shows actual outputs).
