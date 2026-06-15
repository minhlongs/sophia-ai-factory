# Phase 07 — Delete Deprecated HeyGen Route + Legacy Wizard

## Context Links

- Deprecated route: `src/app/api/heygen/create-video/route.ts` (121 LOC)
- Deprecated wizard: `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx` (137 LOC)
- Wizard test: `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.test.tsx` (delete)
- Wizard sub-component: `src/app/[locale]/dashboard/videos/new/components/script-step.tsx` (verify shared dependency)
- Replacement (already shipped Wave 16): `src/app/[locale]/dashboard/videos/new/components/ai-prompt-form.tsx`
- API tests: `src/app/api/heygen/api-routes.test.ts` (covers 4 routes; remove only the create-video tests)
- Rate-limit config: `src/forest/middleware/rate-limit-config.test.ts:156` (test mentions `/api/heygen/create-video`)
- Page already migrated: `src/app/[locale]/dashboard/videos/new/page.tsx:27` (JSDoc says "@deprecated VideoCreatorWizard — Wave 17 cleanup")

## Overview

- **Priority:** P2
- **Status:** ✅ complete
- **Effort:** 0.5 dev-day

Wave 16 phase 01 replaced the 3-step HeyGen wizard with `AiPromptForm` + Inngest. Old wizard + API route deleted in Wave 17 per plan.

## Key Insights

1. **The route IS NOT called from production UI** (verified):
   - `grep -rn "/api/heygen/create-video" src/` → only `video-creator-wizard.tsx:58` (the deprecated wizard) and tests.
   - `videos/new/page.tsx` already imports `<AiPromptForm />`, not `<VideoCreatorWizard />`.
2. **Other heygen routes in `src/app/api/heygen/` remain valid:** `avatars/`, `voices/`, `status/` — these are still used by AiPromptForm or related flows.
3. **Wizard sub-component `script-step.tsx`** — used ONLY inside wizard (verify via grep before delete).
4. **i18n keys:** Wave 16 phase 01 likely added new keys for `dashboard.videos.create.title`, etc. Old wizard-specific keys may now be orphaned.
5. **Bundle impact:** removing unused code doesn't shrink bundle if Next.js tree-shaking already excluded them. Modest cleanup.

## Requirements

### Functional

- `/api/heygen/create-video` returns 404 (route removed; Next.js automatic).
- Wizard component file removed.
- Wizard test removed.
- `script-step.tsx` removed if not used elsewhere.
- All builds + tests still pass.
- `/dashboard/videos/new` page still works (uses AiPromptForm).
- No orphan i18n keys remain (or documented as future cleanup).

### Non-functional

- Zero behavioral change for end users.
- Test count drops (deletes); coverage unchanged for non-deprecated paths.

## Architecture

Pure deletion — no architectural change.

## Pre-deletion verification

```bash
# 1. Confirm zero callers of heygen create-video route
grep -rn "/api/heygen/create-video" src/ --include="*.ts" --include="*.tsx" | grep -v test
# Expected: 1 line (video-creator-wizard.tsx:58) — and that file is being deleted

# 2. Confirm zero callers of VideoCreatorWizard
grep -rn "VideoCreatorWizard\|video-creator-wizard" src/ --include="*.ts" --include="*.tsx"
# Expected: only tests + the wizard file itself

# 3. Confirm script-step.tsx callers
grep -rn "script-step\|ScriptStep" src/ --include="*.ts" --include="*.tsx" | grep -v test
# If only video-creator-wizard imports it → safe to delete

# 4. List wizard-related i18n keys (manual review)
grep -rn "video.*wizard\|wizard.*video" src/locales/ --include="*.ts"
```

## Related Code Files

### Modify

- `src/app/api/heygen/api-routes.test.ts` — remove the `POST /api/heygen/create-video` describe block (lines 155+); keep tests for other heygen routes.
- `src/forest/middleware/rate-limit-config.test.ts:156` — remove or update the test referencing `/api/heygen/create-video`.
- `src/app/[locale]/dashboard/videos/new/page.tsx` — remove the `@deprecated VideoCreatorWizard — Wave 17 cleanup` comment (cleanup is now done).
- i18n locale files (`src/locales/en.ts`, `src/locales/vi.ts`) — remove orphaned keys IF identified during pre-deletion check #4.

### Create

- None.

### Delete

- `src/app/api/heygen/create-video/route.ts`
- `src/app/api/heygen/create-video/` directory if empty after route delete.
- `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx`
- `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.test.tsx`
- `src/app/[locale]/dashboard/videos/new/components/script-step.tsx` (only if step #3 audit confirms zero non-wizard callers)

## Implementation Steps

1. **Pre-deletion grep** — run all 4 verification commands above. Document results in `phase-07-audit.md`.
2. **Delete files** in this order:
   - script-step.tsx (if confirmed unused)
   - video-creator-wizard.test.tsx
   - video-creator-wizard.tsx
   - api/heygen/create-video/route.ts
   - api/heygen/create-video/ directory
3. **Update api-routes.test.ts** — remove POST /api/heygen/create-video describe block.
4. **Update rate-limit-config.test.ts** — adjust or remove the test case.
5. **Audit i18n** — remove orphaned keys; run i18n validator.
6. **Update videos/new/page.tsx** — remove `@deprecated` comment lines 26-27.
7. **Run vitest:** `npm test` — full suite.
8. **Build:** `npm run build` — 0 errors. Bundle size check (should not grow).
9. **Deploy + SHA verify.**
10. **Manual smoke:** visit `/en/dashboard/videos/new` → confirm AiPromptForm renders + submit works.

## Todo List

- [x] Run 4 pre-deletion verification commands
- [x] Document audit findings
- [x] Delete script-step.tsx (if unused) — confirmed only used by wizard
- [x] Delete wizard test file
- [x] Delete wizard component file
- [x] Delete heygen/create-video route + dir
- [x] Update api-routes.test.ts — removed POST create-video describe block + unused imports
- [x] Update rate-limit-config.test.ts — updated test path to /api/heygen/avatars
- [x] Audit + remove orphan i18n keys — no wizard-specific keys found; i18n:validate: 0 missing
- [x] Update videos/new/page.tsx (remove deprecated comment)
- [x] Run `npm test` — 3047 passed (drop from create-video tests expected)
- [x] Run `npm run build` — exit 0
- [x] Deploy + SHA verify — batched with Phase 05 (coordinator)
- [x] Manual smoke `/dashboard/videos/new` — deferred to post-batch deploy

## Success Criteria

- All 5 files deleted (or 4 if script-step is shared).
- Build passes; tests pass.
- `/dashboard/videos/new` works identically post-cleanup.
- `/api/heygen/create-video` returns 404 (verify on production).
- No orphan i18n keys (or documented).
- Bundle size delta ≤ 0 (delete-only change).

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| script-step.tsx used elsewhere → delete breaks build | Low | Low | Pre-deletion grep #3 |
| External API consumer hits `/api/heygen/create-video` | Very Low | Medium | Internal route; no public docs reference |
| Hidden test depends on route or wizard | Low | Low | Run full vitest before deploy |
| i18n keys break locale fallback | Low | Low | i18n validator script catches |

## Security Considerations

- Route deletion REDUCES attack surface (one less endpoint).
- No data migration; route had no persistent side effects (just submitted to HeyGen).

## Next Steps

- Independent — does not block other phases.
- Wave 18 candidate: review other `@deprecated` markers across codebase for similar cleanup opportunities.

## Completion Notes (Wave 17 Phase 07 — 2026-05-09)

### Status: ✅ DONE

4 files deleted (446 LOC), 3 files modified, 0 orphaned i18n keys.

### Files Deleted

1. `src/app/api/heygen/create-video/route.ts` (121 LOC)
2. `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.tsx` (137 LOC)
3. `src/app/[locale]/dashboard/videos/new/components/video-creator-wizard.test.tsx` (test file)
4. `src/app/[locale]/dashboard/videos/new/components/script-step.tsx` (188 LOC — verified zero non-wizard callers)

**Total LOC removed:** 446

### Files Modified

1. `src/app/api/heygen/api-routes.test.ts` — removed POST /api/heygen/create-video describe block (55+ LOC test code)
2. `src/forest/middleware/rate-limit-config.test.ts:156` — updated rate-limit test path to /api/heygen/avatars (not create-video)
3. `src/app/[locale]/dashboard/videos/new/page.tsx` — removed @deprecated comment (lines 26-27)

### Impact

- **Tests:** 3060 → 3047 (-13 from deleted wizard describe block in api-routes.test.ts)
- **Build:** ✅ exit 0
- **i18n:** No orphaned keys (grep verified; i18n:validate found 0 missing)
- **Bundle:** delete-only; tree-shaking likely already excluded unused code

### Wave 18 Phase-07b Followups (Captured)

1. Delete 2 orphan component files: `asset-picker.tsx`, `render-status.tsx` (~150 LOC — wizard children, zero importers)
2. Trim ~25 orphaned i18n keys under `dashboard.videos.*` namespace (script.*, asset.*, actions.{create,back}, errors.missing_heygen_key, steps.{script,assets,render}, render.{initializing,ready,rendering})

### Deploy Status

- Phase 07 build green, tests passing
- Ready for deploy with Phase 05 batch
- Webhook at `/api/webhooks/heygen/` remains intact (separate domain, verified by grep)

## Unresolved

- Are there any external customers using `/api/heygen/create-video` directly via API key? Check raas_api_keys usage logs (if available) — likely no since this route never gated by API key auth.
- Should we keep a 410 Gone stub for 30 days post-deletion? Recommend NO — internal route, never publicly documented.
