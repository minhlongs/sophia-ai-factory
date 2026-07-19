# Mission Engine + 17 AI Commands + SDK

**Status:** In Progress  
**Branch:** main  
**Phase file:** phase-01-mission-engine.md

## Phases

- [x] Plan created
- [x] Phase 1: Migrations 0052 + 0053 + 0054
- [x] Phase 2: Command Registry + Dispatcher core
- [x] Phase 3: 17 Handlers (LIVE + STUB)
- [x] Phase 4: REST API /api/v1/missions
- [x] Phase 5: MCU Credit System + monthly reset cron
- [x] Phase 6: Outbound Webhook delivery
- [x] Phase 7: TypeScript SDK
- [x] Phase 8: Dashboard UI (credits/integrations pages + sidebar links)
- [x] Phase 9: Telegram bot wiring (/missions command)
- [x] Phase 10: Build + tests (2292 pass, 0 TS errors)

## Key Files

- `migrations/0052-missions-engine.sql`
- `migrations/0053-mcu-credits.sql`
- `migrations/0054-proposals.sql`
- `src/lib/missions/command-registry.ts`
- `src/lib/missions/dispatcher.ts`
- `src/lib/missions/handlers/*.ts`
- `src/lib/mcu/credits-repo.ts`
- `src/lib/missions/fire-webhook.ts`
- `src/app/api/v1/missions/**`
- `src/app/api/cron/mcu-monthly-reset/route.ts`
- `src/app/[locale]/dashboard/missions/page.tsx`
- `src/app/[locale]/dashboard/credits/page.tsx`
- `src/app/[locale]/dashboard/integrations/page.tsx`
- `src/sdk/index.ts`
