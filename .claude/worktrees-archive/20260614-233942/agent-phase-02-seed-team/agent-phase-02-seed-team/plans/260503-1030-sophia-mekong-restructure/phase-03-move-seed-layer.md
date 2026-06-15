# Phase 03 — Move seed/ Layer (Infra Primitives)

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-02-typescript-path-aliases.md](phase-02-typescript-path-aliases.md)
- Scout report: `reports/scout-260503-dependency-graph.md`

## Overview
- **Priority:** P1
- **Status:** pending
- **Effort:** 90m
- **Description:** `git mv` all seed-classified files into `src/seed/`. Update every import that points to a moved file via codemod (ts-morph). Atomic commit. Build + test must pass.

## Key Insights
- seed/ has ZERO upstream dependencies on other layers (it's the bottom). If scout reports any inbound from seed → other layer, that file is MISCLASSIFIED — fix scout first, do not start phase 03.
- Tests co-located with source must move TOGETHER (e.g., `lib/utils/foo.test.ts` moves with `lib/utils/foo.ts`).
- Pre-existing `@/lib/utils` callers must become `@/seed/lib/utils` — codemod rewrites in one pass.
- File count target: ~300-500 files (db, utils, types, config, security, base-agent, health, better-auth-*).

## Requirements

### Functional
- Every seed-classified file moved to `src/seed/<original-relative-path>`
- All imports referencing moved files updated to new path (preserve `@/seed/...` alias style)
- No imports left pointing to old `@/lib/db/...` for moved-to-seed files
- `git log --follow` works (history preserved via `git mv`)
- `npm run build`, `npm test`, `npm run lint` pass

### Non-Functional
- Single atomic commit
- Zero barrel re-exports at old paths (forbidden by dev-rules.md)

## Architecture

### Before
```
src/
├── lib/db/...
├── lib/utils/...
├── lib/security/...
├── lib/health/...
├── lib/agents/base-agent.ts
├── lib/better-auth-server.ts
├── types/...
└── config/...
```

### After
```
src/
└── seed/
    ├── lib/db/...
    ├── lib/utils/...
    ├── lib/security/...
    ├── lib/health/...
    ├── lib/agents/base-agent.ts
    ├── lib/better-auth-server.ts
    ├── types/...
    └── config/...
```

## Related Code Files

### To create
- `apps/sophia-ai-factory/scripts/codemod-relocate-imports.mts` — reusable for phases 03-06

### To move (via `git mv`)
Per scout report `seed` bucket — exact list locked at Phase 01 completion. Tentative globs:
- `src/lib/db/**/*` → `src/seed/lib/db/**/*`
- `src/lib/utils/**/*` → `src/seed/lib/utils/**/*`
- `src/lib/security/**/*` → `src/seed/lib/security/**/*`
- `src/lib/health/**/*` → `src/seed/lib/health/**/*`
- `src/lib/agents/base-agent*` → `src/seed/lib/agents/base-agent*`
- `src/lib/better-auth-{client,server,session}.ts` → `src/seed/lib/better-auth-*.ts`
- `src/types/**/*` → `src/seed/types/**/*`
- `src/config/**/*` → `src/seed/config/**/*`

### To modify (via codemod)
- ANY file importing from above paths — codemod rewrites import strings

## Implementation Steps

1. Read scout report `seed` bucket; export list to `/tmp/seed-files.txt`
2. Create `scripts/codemod-relocate-imports.mts` (ts-morph based):
   - Input: JSON map `{ oldPath: newPath, ... }`
   - For each SourceFile in project: rewrite ImportDeclaration moduleSpecifiers matching map
   - Save modifications
3. Build move map from scout list
4. Execute moves: `cat /tmp/seed-files.txt | xargs -I{} bash -c 'mkdir -p "$(dirname "src/seed/{...}")" && git mv "{}" "src/seed/{...}"'`
   (precise script generated from scout output to avoid path errors)
5. Run codemod with move map → updates all imports across whole project
6. Clear caches: `rm -rf .next .open-next .turbo`
7. Run `npm run build` — must pass
8. Run `npm test` — must pass
9. Run `npm run lint` — must pass
10. Verify zero stale imports: `grep -r "from '@/lib/db" src/ --include="*.ts" --include="*.tsx" | wc -l` should return 0 (all become `@/seed/lib/db`)
11. Commit: `refactor(seed): mekong layer 1 — move primitives into src/seed/`

## Todo List

- [ ] Create codemod script
- [ ] Build move map from scout output
- [ ] Execute git mv batch
- [ ] Run codemod for imports
- [ ] Build passes
- [ ] Tests pass
- [ ] Lint passes
- [ ] Zero stale imports verified
- [ ] Commit

## Success Criteria
- `git status` shows only RENAMES (R) for moved files, MODIFIED (M) for import-updated files — NO new files, NO deletes
- Build/test/lint all green
- `git log --follow src/seed/lib/db/<file>` shows full history pre-move
- Zero `:any` introduced

## Risk Assessment
- **H** Codemod misses import strings that use template literals or computed paths. Mitigation: scout report flags these; manual fix list.
- **M** ESLint may complain about new alias resolution mid-migration. Mitigation: temporarily disable `import/no-unresolved` for the commit if needed (re-enable Phase 07).
- **M** Vitest config path mappings out of sync. Mitigation: verify `vitest.config.*` reads tsconfig paths via `vite-tsconfig-paths` plugin.
- **L** OpenNext build differs from Next dev. Mitigation: run `npx opennextjs-cloudflare build` before commit.

## Security Considerations
- No production deploy in this phase. Local only.

## Next Steps
- **Unblocks:** Phase 04 (move tree/)
- **Rollback:** `git revert <phase-03-commit>` restores previous state (single atomic commit)
