# Project: SOP Dashboard Quality Sweep

## Architecture
The SOP (Standard Operating Procedure) system in `apps/sophia-ai-factory` consists of:
- **Creator Dashboard**: Manage templates, earnings, view tables of created SOPs.
- **Marketplace**: List official templates, view installation states.
- **SOP List Page**: Shows installed/configured SOPs.
- **D1 Database**: Cloudflare D1 SQL database storing `sop_templates` and installation details.
- **Translations (`next-intl`)**: Bilingual support (English/Vietnamese) via `messages/en.json` and `messages/vi.json`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Translation & Test Clean | Fix bilingual ternaries, translate Creator & Marketplace pages, remove duplicate test file (R1, R2, R3) | None | PLANNED |
| 2 | M2: DB & Error Optimization | Fix N+1 queries, add early `getD1()` null guards (R4, R5) | M1 | PLANNED |
| 3 | M3: Detail Page & Action Integration | Create creator detail page route, wire `submitForReviewAction` button to publish (R6, R7) | M2 | PLANNED |

## Interface Contracts
- Translations: Key-based retrieval using `next-intl`'s `getTranslations('sop.creator')` and `getTranslations('sop.marketplace')`.
- Repository functions: Use of `db` (`D1Database`) client to fetch templates. Batch retrieval of templates via IDs to optimize performance.
- Actions: `submitForReviewAction(id: string)` in `sop-creator/actions.ts` changes template status to `published`.

## Code Layout
- SOP Creator Page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx`
- SOP Creator Actions: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/actions.ts`
- SOP Creator Detail Page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/[id]/page.tsx`
- SOP Marketplace Page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx`
- SOP List Page: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx`
- Messages EN: `apps/sophia-ai-factory/messages/en.json`
- Messages VI: `apps/sophia-ai-factory/messages/vi.json`
