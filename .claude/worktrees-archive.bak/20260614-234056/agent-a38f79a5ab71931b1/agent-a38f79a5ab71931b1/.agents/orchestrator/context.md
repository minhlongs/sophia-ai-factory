# Context Log

## System Configuration
- OS: mac
- Project directory: `/Users/macbook/projects/sophia-ai-factory`

## Key Paths
- Translation files: `messages/en.json`, `messages/vi.json`
- Page files:
  - SOP Creator: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/page.tsx`
  - SOP Marketplace: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-marketplace/page.tsx`
  - SOP List: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/page.tsx`
  - SOP Detail: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sops/[id]/page.tsx`
- Actions file: `apps/sophia-ai-factory/src/app/[locale]/dashboard/sop-creator/actions.ts`
- Database: D1 database interface

## Build and Test Commands
- Tests: `npx vitest run src/forest/components/sop/ src/lib/sop/`
- TypeScript compilation: `npx tsc --noEmit`
