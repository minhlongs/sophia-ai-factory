---
phase: 2
title: "Merge RaaS components into dashboard"
priority: P1
status: completed
---

# Phase 2: Merge RaaS Components into Dashboard

## Context Links
- Source components: `apps/sophia-proposal/components/raas/`
- Source proposals: `apps/sophia-proposal/components/proposals/`
- Source lib: `apps/sophia-proposal/lib/raas/`
- Source API: `apps/sophia-proposal/app/api/raas/`
- Target dashboard: `apps/sophia-ai-factory/src/app/[locale]/dashboard/`
- Existing RaaS lib: `apps/sophia-ai-factory/src/lib/raas-*.ts`
- Source types: `apps/sophia-proposal/types/raas.ts`

## Overview

Bring RaaS dashboard components (missions, API keys, proposals) into ai-factory's existing `[locale]/dashboard/`. The ai-factory already has RaaS backend services -- this phase connects the UI.

## Key Insights

- ai-factory already has: `raas-service.ts`, `raas-gate.ts`, `raas-key-generator.ts`, `raas-schema.ts`, `raas-audit.ts`, worker middleware
- ai-factory already has admin API key routes: `api/admin/api-keys/`
- Missing: dashboard UI for missions, API keys, proposal generation
- Components over 200 lines need splitting: `api-key-manager.tsx` (276), `ai-generate-form.tsx` (293)

## Related Code Files

### Files to Create (Dashboard Routes)
- `src/app/[locale]/dashboard/missions/page.tsx` -- mission dashboard page
- `src/app/[locale]/dashboard/missions/loading.tsx`
- `src/app/[locale]/dashboard/missions/[id]/page.tsx` -- mission detail page
- `src/app/[locale]/dashboard/api-keys/page.tsx` -- API key management page
- `src/app/[locale]/dashboard/proposals/page.tsx` -- proposal generator page

### Files to Create (Components)
- `src/components/raas/mission-dashboard.tsx` -- adapted from proposal (124 lines, OK)
- `src/components/raas/mission-detail.tsx` -- adapted from proposal (123 lines, OK)
- `src/components/raas/mission-launcher.tsx` -- adapted from proposal (142 lines, OK)
- `src/components/raas/mcu-balance-widget.tsx` -- adapted from proposal (75 lines, OK)
- `src/components/raas/api-key-list.tsx` -- split from api-key-manager (list + actions)
- `src/components/raas/api-key-create-modal.tsx` -- split from api-key-manager (create form)
- `src/components/proposals/proposal-generate-form.tsx` -- split from ai-generate-form (form fields)
- `src/components/proposals/proposal-generate-actions.tsx` -- split from ai-generate-form (submit + preview)
- `src/components/proposals/proposal-editor.tsx` -- adapted from proposal (144 lines, OK)

### Files to Create (API Routes)
- `src/app/api/raas/missions/route.ts` -- list + create missions
- `src/app/api/raas/missions/[id]/route.ts` -- get + update mission
- `src/app/api/raas/templates/route.ts` -- list mission templates
- `src/app/api/raas/usage/route.ts` -- usage stats
- `src/app/api/raas/execute/route.ts` -- execute mission (PEV)

### Files to Create (Types)
- `src/types/raas.ts` -- copy from proposal, already well-structured (145 lines)

### Files to Modify
- `src/app/[locale]/dashboard/layout.tsx` -- add nav items: Missions, API Keys, Proposals
- `messages/en.json` -- add `dashboard.missions.*`, `dashboard.apiKeys.*`, `dashboard.proposals.*`
- `messages/vi.json` -- same

### Files NOT to Create (already exist in ai-factory)
- RaaS lib services (raas-service.ts, raas-gate.ts, etc.) -- use existing
- Admin API key routes -- use existing `/api/admin/api-keys/`
- Worker middleware -- already has raas-auth-middleware.ts

## Implementation Steps

1. Copy `types/raas.ts` from proposal to `src/types/raas.ts` in ai-factory (clean copy, already good)

2. Create RaaS components by adapting proposal components:
   - Split `api-key-manager.tsx` (276 lines) into `api-key-list.tsx` + `api-key-create-modal.tsx`
   - Split `ai-generate-form.tsx` (293 lines) into `proposal-generate-form.tsx` + `proposal-generate-actions.tsx`
   - Adapt remaining components (under 200 lines) with minimal changes:
     - Replace `@/lib/billing/polar-client` imports with local tier config
     - Use `useTranslations()` for i18n
     - Use ai-factory's `@/components/ui/*`

3. Create API routes by adapting proposal's `/api/raas/*`:
   - Use existing `raas-service.ts` and `raas-gate.ts` for business logic
   - Add Zod validation on all inputs (per project rules)
   - Use existing auth middleware

4. Create dashboard pages (thin wrappers around components):
   - `missions/page.tsx` -- renders MissionDashboard + MissionLauncher
   - `missions/[id]/page.tsx` -- renders MissionDetail
   - `api-keys/page.tsx` -- renders ApiKeyList + ApiKeyCreateModal
   - `proposals/page.tsx` -- renders ProposalGenerateForm + ProposalEditor

5. Update dashboard layout nav to include new sections

6. Add i18n keys for all new dashboard sections

## Todo List

- [x] Copy raas.ts types
- [x] Create mission components (dashboard, detail, launcher)
- [x] Create mcu-balance-widget
- [x] Split and create API key components
- [x] Split and create proposal components
- [x] Create proposal-editor component
- [x] Create API routes (missions, templates, usage, execute)
- [x] Create dashboard pages (missions, api-keys, proposals)
- [x] Update dashboard layout navigation
- [x] Add en/vi translations
- [x] Verify build passes

## Success Criteria

- Dashboard has functional Missions, API Keys, Proposals sections
- Mission CRUD works end-to-end via API routes
- All components under 200 lines
- Zod validation on all API inputs
- i18n works en/vi
- `npm run build` + `npm test` pass

## Risk Assessment

- **Import conflicts**: proposal uses `@/lib/billing/polar-client` -- must replace with NOWPayments config (Phase 3 handles pricing, but components should not reference Polar directly)
- **Supabase schema**: RaaS tables must exist -- check migration `20260308-create-raas-api-keys.sql` already applied
- **MCU balance**: proposal uses Polar MCU credits -- in unified version, MCU maps to NOWPayments tier allowance
