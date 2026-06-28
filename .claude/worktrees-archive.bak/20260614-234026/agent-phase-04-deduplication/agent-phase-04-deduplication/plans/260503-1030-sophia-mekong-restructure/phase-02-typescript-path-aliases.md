# Phase 02 — TypeScript Path Aliases Setup

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-01-scout-dependency-analysis.md](phase-01-scout-dependency-analysis.md)
- Files: `apps/sophia-ai-factory/tsconfig.json`, `next.config.ts`

## Overview
- **Priority:** P1 (gating for Phases 03-06)
- **Status:** pending
- **Effort:** 30m
- **Description:** Add `@/seed/*`, `@/tree/*`, `@/forest/*`, `@/land/*` path aliases. Verify build/test still pass BEFORE any file moves. Aliases let Phases 03-06 codemod imports to layer-prefixed paths atomically.

## Key Insights
- Existing `@/*` → `./src/*` MUST be kept for backward compatibility during migration
- New aliases resolve to NOT-YET-CREATED dirs (`./src/seed`, `./src/tree`, `./src/forest`, `./src/land`) — TS won't fail on unused aliases, but ESLint may
- Next.js 16 reads tsconfig paths automatically; no separate webpack alias needed
- Cloudflare Workers (OpenNext) reads same tsconfig — should work without changes

## Requirements

### Functional
- Add 4 new path aliases to `tsconfig.json`
- Create empty placeholder `src/seed/.gitkeep`, `src/tree/.gitkeep`, etc. so dirs exist
- `npm run build` passes
- `npm test` passes
- `npm run lint` passes (no new ESLint errors)

### Non-Functional
- Must NOT break dev server hot reload
- Must NOT break Cloudflare Workers build (OpenNext)

## Architecture
```jsonc
// tsconfig.json — paths section after edit
"paths": {
  "@/*":        ["./src/*"],          // KEEP for migration safety
  "@/seed/*":   ["./src/seed/*"],     // NEW
  "@/tree/*":   ["./src/tree/*"],     // NEW
  "@/forest/*": ["./src/forest/*"],   // NEW
  "@/land/*":   ["./src/land/*"]      // NEW
}
```

## Related Code Files

### To modify
- `apps/sophia-ai-factory/tsconfig.json` — add 4 paths

### To create
- `apps/sophia-ai-factory/src/seed/.gitkeep`
- `apps/sophia-ai-factory/src/tree/.gitkeep`
- `apps/sophia-ai-factory/src/forest/.gitkeep`
- `apps/sophia-ai-factory/src/land/.gitkeep`

### To read (verify, no edits expected)
- `apps/sophia-ai-factory/next.config.ts` — confirm no manual webpack alias overrides

## Implementation Steps

1. Read current `tsconfig.json` — confirm baseline
2. Add 4 new path entries (KEEP `@/*` entry intact)
3. `mkdir -p src/{seed,tree,forest,land}` and `touch .gitkeep` in each
4. Run `rm -rf .next .open-next .turbo node_modules/.cache` to flush stale resolution
5. Run `npm run build` — must succeed
6. Run `npm test` — must succeed (sample subset OK, e.g. `vitest run --reporter=dot --bail=1`)
7. Run `npm run lint` — must succeed
8. Commit: `chore(tsconfig): add @/seed @/tree @/forest @/land path aliases for mekong restructure`

## Todo List

- [ ] Edit tsconfig.json paths
- [ ] Create 4 layer dirs with .gitkeep
- [ ] Clear build cache
- [ ] Verify build passes
- [ ] Verify tests pass
- [ ] Verify lint passes
- [ ] Commit

## Success Criteria
- `tsc --noEmit` exits 0
- `npm run build` exits 0
- `npm test` exits 0
- `git status` shows only `tsconfig.json` + 4 `.gitkeep` files

## Risk Assessment
- **L** Next.js 16 path alias regression. Mitigation: verify with `npm run dev` smoke test on `/`, `/pricing`, `/dashboard`.
- **L** OpenNext build resolves paths differently. Mitigation: run `npx opennextjs-cloudflare build` locally before commit.

## Security Considerations
- None (config-only change).

## Next Steps
- **Unblocks:** Phase 03 (move seed/)
- **No git push** to main yet — push at end of Phase 06 or batch with Phase 09
