# Phase J3 — Wave 14 BYOK MissionLauncher Wiring

**Date:** 2026-05-09
**Status:** COMPLETE

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `migrations/0097-engine-missions-model-id.sql` | 9 | NEW — ADD COLUMN byok_provider_id + byok_model_id + index |
| `src/seed/db/types.ts` | +22 | Added EngineMissionDbRow type with byok columns |
| `src/app/api/raas/missions/route.ts` | +30 | ModelSchema, model field in 3 schemas, BYOK validation, INSERT byok columns |
| `src/forest/components/raas/mission-launcher.tsx` | +7 | Import ByokProviderPicker, selectedModel state, wired picker + submit payload |
| `messages/en.json` | +1 | Added byok.picker.placeholder_label key |
| `messages/vi.json` | +1 | Added byok.picker.placeholder_label key (Vietnamese) |
| `src/app/api/raas/missions/__tests__/route.test.ts` | 130 | NEW — 6 tests |

## Tasks Completed

- [x] Migration 0097: ADD COLUMN byok_provider_id TEXT + byok_model_id TEXT + conditional index
- [x] ModelSchema: `z.object({ providerId, modelId }).optional()` added to all 3 schemas (nl, template, legacy)
- [x] BYOK validation: queries `user_api_keys WHERE user_id=? AND provider=?` — returns 400 if not configured
- [x] INSERT: byok_provider_id + byok_model_id passed from model field (null if absent)
- [x] MissionLauncher: ByokProviderPicker imported + selectedModel state + wired above submit button
- [x] Submit payload: `model: { providerId, modelId }` included if selectedModel is set
- [x] i18n: byok.picker.placeholder_label added to en.json + vi.json

## Tests Status

- Type check: PASS (0 errors)
- New tests: 6 pass
- Full suite: 2919 pass | 31 skipped (up from 2901 baseline +6 new +12 pre-existing additions from Wave 13/other)

## D1 Migration Note

D1 does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Migration 0097 uses plain `ALTER TABLE` — idempotency handled by `apply-migrations.sh` tracking table (`supabase_migrations_applied`). Run after deploy:

```bash
cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh
```

## BYOK Validation Logic

- Table queried: `user_api_keys` (per `tree/byok/user-api-key-store.ts` — stores provider keys encrypted)
- Field matched: `provider` column (e.g. `anthropic`, `openrouter`, `openai`)
- Note: picker exposes `openai` as a provider; `user_api_keys` table currently allows any string — no enum enforcement at DB level

## Unresolved Questions

- `openai` provider not in current `ByokProvider` union in `user-api-key-store.ts` (only `openrouter|anthropic|elevenlabs|d-id|heygen|muapi`). If a user tries to select an OpenAI model from the picker but has no `openai` key stored, they get a 400. This is correct behavior but the picker still shows OpenAI models regardless. Future work: filter picker to only show providers actually in the `ByokProvider` union.
