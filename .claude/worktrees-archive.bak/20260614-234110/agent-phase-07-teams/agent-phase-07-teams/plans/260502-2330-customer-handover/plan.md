# Customer Handover System — Plan

**Created:** 2026-05-02  
**Status:** In Progress  
**Branch:** main

## Goal
CEO clicks "Handover" → 3-min wizard → customer gets magic link + welcome page + pre-installed SOPs + handover doc.

## Phases

| # | Deliverable | Status |
|---|-------------|--------|
| 1 | Migration 0064 (customer_handovers table) | ✅ |
| 2 | Handover doc generator lib | ✅ |
| 3 | Admin Handover Wizard page (A) | ✅ |
| 4 | Admin API routes (POST/GET/PATCH handover) | ✅ |
| 5 | Customer Welcome page /welcome/[token] (C) | ✅ |
| 6 | Customer onboarding banner (E) | ✅ |
| 7 | Admin Handover Tracking list page (F) | ✅ |
| 8 | Runbook doc (G) | ✅ |
| 9 | Build + tests | ✅ 2414 pass |

## Key Files
- `apps/sophia-ai-factory/migrations/0064-customer-handovers.sql`
- `apps/sophia-ai-factory/src/lib/handover/handover-doc-generator.ts`
- `apps/sophia-ai-factory/src/lib/handover/handover-email-service.ts`
- `apps/sophia-ai-factory/src/lib/handover/handover-magic-link.ts`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/admin/handover/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/admin/handover/handover-wizard-client.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/admin/handover/list/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/admin/handover/list/handover-list-client.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/welcome/[token]/page.tsx`
- `apps/sophia-ai-factory/src/app/api/admin/handover/create/route.ts`
- `apps/sophia-ai-factory/src/app/api/admin/handover/list/route.ts`
- `apps/sophia-ai-factory/src/app/api/admin/handover/[id]/route.ts`
- `apps/sophia-ai-factory/src/app/api/admin/handover/[id]/resend-welcome/route.ts`
- `apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/route.ts`
- `apps/sophia-ai-factory/src/components/dashboard/handover-onboarding-banner.tsx`
- `docs/customer-handover-runbook.md`
