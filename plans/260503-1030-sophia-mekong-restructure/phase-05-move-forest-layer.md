# Phase 05 — Move forest/ Layer (Multi-Tenant SaaS Plumbing)

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-04-move-tree-layer.md](phase-04-move-tree-layer.md)
- Scout report: `reports/scout-260503-dependency-graph.md`

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 90m
- **Description:** Move forest-classified files (multi-tenant plumbing) into `src/forest/`. Same pattern as Phase 03/04.

## Key Insights
- forest/ may import seed/ + tree/ (allowed: down). Forest must NOT import land/ — verify in scout.
- `tenant-isolation` middleware sits in `src/middleware/` — request-time critical. Test middleware chain integrity after move.
- API routes under `src/app/api/v1/api-keys/` and `src/app/api/welcome/` — same route-file rule from Phase 04 (ROUTE STAYS, internals MOVE).
- Email templates under `lib/email/` may include MJML/HTML files — `git mv` preserves these too.
- File count target: ~200-400 files.

## Requirements

### Functional
- All forest non-route files moved to `src/forest/<original-relative-path>`
- Middleware chain unchanged (verify by request to `/api/v1/api-keys` returns same headers/status)
- Build/test/lint pass

### Non-Functional
- Atomic single commit

## Architecture
```
src/
├── seed/...
├── tree/...
├── forest/                          (NEW)
│   ├── lib/outbox/...
│   ├── lib/api-keys/...
│   ├── lib/email/...
│   ├── lib/onboarding/...
│   ├── lib/quota/...
│   ├── lib/usage-metering/...
│   └── middleware/tenant-isolation*.ts
└── app/
    ├── api/v1/api-keys/route.ts     (STAYS — imports rewritten)
    └── api/welcome/route.ts          (STAYS — imports rewritten)
```

## Related Code Files

### To move
- `src/lib/outbox/**/*` → `src/forest/lib/outbox/**/*`
- `src/lib/api-keys/**/*` → `src/forest/lib/api-keys/**/*`
- `src/lib/email/**/*` → `src/forest/lib/email/**/*`
- `src/lib/onboarding/**/*` → `src/forest/lib/onboarding/**/*`
- `src/lib/quota/**/*` → `src/forest/lib/quota/**/*`
- `src/lib/usage-metering/**/*` → `src/forest/lib/usage-metering/**/*`
- `src/middleware/tenant-isolation*.ts` → `src/forest/middleware/tenant-isolation*.ts`

### Stays in place
- All `src/app/api/**/route.ts` and `src/app/[locale]/onboarding/**/page.tsx` route files
- Root `src/middleware.ts` (Next.js requires it at this exact path)

### To modify (codemod)
- All importers
- Route files (imports rewritten)
- `src/middleware.ts` if it imports tenant-isolation directly (very likely)

## Implementation Steps

1. Read scout report `forest` bucket; split move/stay
2. CRITICAL: verify `src/middleware.ts` still imports the moved tenant-isolation correctly
3. Generate move map
4. Snapshot routes (as Phase 04)
5. `git mv` batch
6. Codemod imports
7. Verify routes diff empty
8. Build + test + lint
9. Smoke: `npm run dev` → curl `/api/v1/api-keys` (expect 401 unauth, NOT 404), curl `/onboarding` (200)
10. Smoke middleware chain: send request with `X-Tenant-Id` header, verify isolation logic still triggers (existing test in `__tests__/middleware/tenant-isolation*.test.ts`)
11. Commit: `refactor(forest): mekong layer 3 — multi-tenant plumbing moved to src/forest/`

## Todo List

- [ ] Split forest files
- [ ] Verify middleware.ts dependencies
- [ ] Execute moves
- [ ] Codemod imports
- [ ] Routes unchanged check
- [ ] Build/test/lint
- [ ] Smoke routes + middleware
- [ ] Commit

## Success Criteria
- Routes unchanged
- `__tests__/middleware/tenant-isolation*.test.ts` PASS
- Build/test/lint green

## Risk Assessment
- **H** Middleware chain regression breaks tenant isolation → security incident. Mitigation: tenant-isolation test suite is GATING.
- **H** Inngest / cron jobs reference stale paths at runtime (dynamic imports). Mitigation: grep for `import(` and `require(` with template literals in scout.
- **M** Email template paths hardcoded in code (e.g., `path.join(__dirname, 'templates/welcome.mjml')`). Mitigation: scout reports `__dirname` usages.
- **L** Outbox worker job IDs change → in-flight jobs orphaned. Mitigation: Outbox uses content hash or DB id, not file path. Verify.

## Security Considerations
- Tenant isolation MUST remain effective. Block phase 06 if any tenant-isolation test fails.

## Next Steps
- **Unblocks:** Phase 06 (move land/)
