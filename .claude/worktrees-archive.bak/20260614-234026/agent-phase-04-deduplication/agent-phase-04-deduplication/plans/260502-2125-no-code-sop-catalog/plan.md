# No-Code SOP Catalog — Plan

**Goal:** Make SOP marketplace 100% no-code for non-technical agency owners.

## Phases

- [x] Phase 0: Read codebase + plan (this file)
- [ ] Phase 1: Migration 0059 — config_schema columns on sop_templates + config_values on installations
- [ ] Phase 2: arg-resolver {{config.X}} substitution + tests
- [ ] Phase 3: 31 seed files across 7 categories
- [ ] Phase 4: Migration 0060 — 31 seeds via generate script
- [ ] Phase 5: Form-based install modal (replaces textarea)
- [ ] Phase 6: Update install action to accept configValues
- [ ] Phase 7: Marketplace UI (featured badge, category icons, setup-time badge)
- [ ] Phase 8: Editor tab form mode + advanced toggle
- [ ] Phase 9: i18n keys Vi+En
- [ ] Phase 10: Tests + build

## Key Files
- `migrations/0059-sop-config-schema.sql` — new columns
- `migrations/0060-sop-seed-31-playbooks.sql` — 31 seeds
- `src/lib/sop/seeds/playbooks/` — 31 seed files
- `src/lib/sop/seeds/index.ts` — barrel re-export
- `src/lib/sop/executor/arg-resolver.ts` — {{config.X}} support
- `src/components/sop/sop-install-modal.tsx` — form-based
- `src/components/sop/sop-card.tsx` — featured + badges
- `src/components/sop/sop-grid.tsx` — grouped by category
- `src/lib/sop/sop-types.ts` — extended types
- `messages/{en,vi}.json` — new i18n keys
