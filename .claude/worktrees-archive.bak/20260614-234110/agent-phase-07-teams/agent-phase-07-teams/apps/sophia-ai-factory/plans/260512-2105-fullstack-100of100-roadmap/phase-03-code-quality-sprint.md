# Phase 3: Code Quality Sprint

## Context Links

- Audit: `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` §4 G4/G5/G10/G16
- Audit Layer 5 §3 — ESLint error breakdown (274 errors total)
- Layer arch rules: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
- Cross-layer rules: `apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md`
- Next.js 16 Link docs: https://nextjs.org/docs/app/api-reference/components/link
- React 19 / react-compiler: https://react.dev/learn/react-compiler

## Overview

- **Priority:** P1
- **Status:** pending
- **Brief:** Eliminate 274 ESLint errors across 4 categories — layer violations (2), `<a>`→`<Link>` (~100), `:any` types (~46), react-compiler (~57). HARDEST phase. After this, flip G2 lint to fail-mode.
- **Effort:** ~8h
- **Score impact:** +3 (81 → 87) + unlocks pre-push lint enforcement

## Key Insights

| Gap | Insight |
|-----|---------|
| G16 | Only 2 violations — likely `forest/X.ts` importing `land/Y.ts` non-orchestration, or `tree/X.ts` reaching into forest. Per `cross-layer-orchestration.md`, **forest→land is allowed for orchestration**. Each violation needs case-by-case decision: extract to seed, invert via event, or relabel. |
| G5 | ~100 `<a href="/...">` need `<Link href="/...">`. Next.js 16: `Link` no longer auto-wraps `<a>` — pass children directly. Codemod must preserve `className`, `target`, `rel`. **Manual review for external links** (`href="https://..."` MUST stay `<a>`). |
| G10 | ~46 `:any` types — quality-of-life refactor. Inspect each: if from external lib without types, use `unknown` + narrow with zod. If internal, define proper interface. |
| G4 | ~57 react-compiler errors. Triage required: **(a) genuine React 19 patterns** needing `useCallback`/`useMemo` wrappers; **(b) anti-patterns** (mutating refs in render, side-effects in render) requiring refactor; **(c) false positives** for stable references that need eslint-disable-next-line with justification comment. |

## Requirements

**Functional:**
- F1: `npm run ci:lint` exits 0 (zero errors, warnings allowed)
- F2: All `<Link>` replacements preserve original props (className, target, rel, etc.)
- F3: No `:any` types remain in src/ (use `unknown` + zod where unavoidable)
- F4: Layer architecture violations resolved or whitelisted via comment+rationale
- F5: After F1-F4: flip `.husky/pre-push` `ci:lint` from warn-only to fail mode

**Non-functional:**
- Zero test regression (4081+ vitest pass count maintained)
- Bundle size: no significant increase (Link import is already widely used)
- Build time stable

## Architecture

```
Triage → Fix → Verify pipeline (per gap):

G16: grep violations → review each → apply seed/event/orchestration fix → re-lint
G5:  codemod (jscodeshift) → manual review external links → re-lint → smoke test nav
G10: grep ": any" → per-file analysis → introduce interface OR unknown+zod
G4:  per-file analysis → categorize a/b/c → apply useCallback/refactor/disable+comment
```

## Related Code Files

**Modify (estimated 100-150 files):**

| Gap | Likely paths |
|-----|--------------|
| G16 | 2 files — identify via `npm run ci:lint 2>&1 \| grep "no-restricted-imports"` |
| G5  | `src/app/dashboard/**/*.tsx`, `src/forest/components/**/*.tsx` (anywhere `<a href="/...">` exists) |
| G10 | scattered — `grep -rn ": any" src/ \| wc -l` for current count |
| G4  | `src/**/use*.ts`, components using hooks |

**Create:**
- `scripts/codemods/a-to-link.ts` — jscodeshift codemod for G5 (or use sed-based one-liner if simple enough)

**Delete:** None

## Implementation Steps

### Step A — G16 Layer Violations (30min)

1. Identify violations:
   ```bash
   npm run ci:lint 2>&1 | grep "no-restricted-imports" -A2
   ```
2. For each (2 files):
   - If `forest→land` and orchestration role → add comment per `cross-layer-orchestration.md`, request rule exception in lint config
   - If `tree→forest` → MUST refactor: extract logic to seed OR invert via event
   - If anything else → extract shared code to seed
3. Re-run lint, confirm 0 layer violations.

### Step B — G5 `<a>` → `<Link>` (3h)

4. Audit external-link skip list:
   ```bash
   grep -rn '<a href="http' src/ | wc -l    # MUST stay <a>
   grep -rn '<a href="/' src/ | wc -l       # needs <Link>
   ```
5. Verify Next.js 16 Link API in current codebase: `grep -rn "from 'next/link'" src/ | head -3` — confirm import path.
6. Write codemod `scripts/codemods/a-to-link.ts` OR use semi-manual sed pattern. Recommended: jscodeshift with AST manipulation (handles props correctly).
7. Run codemod on `src/`. Diff each file before commit.
8. Manual review:
   - Check `target="_blank"` cases (Link works, but ensure rel="noopener" present)
   - Check `<a>` with onClick — Link's onClick prop is supported
   - Skip dynamic `href={someExternalVar}` cases without static prefix
9. `npm run build` — verify 0 TS errors.
10. `npm test` — verify navigation tests still pass.

### Step C — G10 `:any` Types (2h)

11. List:
    ```bash
    npm run ci:lint 2>&1 | grep "no-explicit-any" -A1 | grep -v "^--" > /tmp/any-list.txt
    ```
12. Per file:
    - Function params: define interface based on caller
    - External lib: import lib types OR use `unknown` + zod parse
    - Test files: `as unknown as X` cast acceptable if isolated
13. Re-lint after each batch of 10 files.

### Step D — G4 React-Compiler Triage (2.5h)

14. Categorize all 57 errors:
    ```bash
    npm run ci:lint 2>&1 | grep "react-compiler" > /tmp/rc-errors.txt
    ```
15. For each error class:
    - **Cannot Create State in Hook**: legit pattern → `useCallback` wrap OR `useMemo`
    - **Cannot Set State In Render**: anti-pattern → refactor to `useEffect` or event handler
    - **Reactive Variable**: stable ref needed → `useRef` OR `useCallback(deps)`
    - **Mutation of frozen value**: refactor (immutable update)
16. Document false positives with `// eslint-disable-next-line react-compiler/react-compiler -- <rationale>`
17. Per CLAUDE.md "Zero `:any` types" + "No console.log" rules — preserve while fixing.

### Step E — Finalize & Enforce (30min)

18. Final lint run: `npm run ci:lint` → exit 0 expected.
19. Full test: `npm test` — confirm 4081+ pass.
20. Build: `npm run build` — 0 errors.
21. **Flip Phase 1 G2 to fail mode** — edit `.husky/pre-push`:
    ```bash
    # OLD: npm run ci:lint || echo "warn..."
    # NEW: npm run ci:lint
    ```
22. Commit + deploy: `feat(quality): zero lint errors, enforce ci:lint in pre-push`
23. SHA match verify post-deploy.

## Todo List

- [ ] G16: List 2 layer violations from lint output
- [ ] G16: Fix violation 1 (extract/invert/document)
- [ ] G16: Fix violation 2 (extract/invert/document)
- [ ] G5: Audit external vs internal `<a>` counts
- [ ] G5: Verify Next.js 16 Link import path in codebase
- [ ] G5: Write/install codemod for `<a>`→`<Link>`
- [ ] G5: Run codemod on src/
- [ ] G5: Manual review (target blank, onClick, dynamic hrefs)
- [ ] G5: `npm run build` 0 errors
- [ ] G10: Generate `:any` list
- [ ] G10: Refactor each — interface, unknown+zod, or proper type
- [ ] G4: Triage 57 react-compiler errors into a/b/c categories
- [ ] G4: Apply useCallback/useMemo for legit patterns
- [ ] G4: Refactor anti-patterns
- [ ] G4: Add eslint-disable comments with rationale for false positives
- [ ] Final: `npm run ci:lint` exit 0
- [ ] Final: `npm test` 4081+ pass
- [ ] Final: `npm run build` 0 errors
- [ ] **Flip G2 in `.husky/pre-push` to fail mode (no warn fallback)**
- [ ] Deploy + SHA verify
- [ ] Update `docs/code-standards.md` with new lint enforcement

## Success Criteria

- `npm run ci:lint` exits 0 (allow warnings, 0 errors)
- `npm test` 4081+ pass — no regression
- `npm run build` exit 0
- `.husky/pre-push` enforces lint (test by intentionally introducing error → push rejected)
- Layer architecture: 0 violations per `grep -rn "from ['\"]@/forest" src/land/` and `grep -rn "from ['\"]@/forest\|@/land" src/tree/`
- SHA match verified post-deploy
- Production smoke: 5+ key dashboard pages navigate correctly (Link change validation)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Codemod corrupts JSX (e.g., losing className) | Diff each file before commit; run tests after each batch |
| Next.js 16 Link API differs from old version | Verify via 1-2 manual conversions first; check docs |
| External `<a href="http">` accidentally wrapped in Link | Codemod whitelist external href patterns |
| react-compiler fixes introduce render-loop bugs | Test affected components in dev mode; rely on existing test suite |
| `:any` → `unknown` migrations break callers | TypeScript will surface; fix transitively |
| Layer fix introduces circular import | Build will catch; revert and re-extract to seed instead |
| Flipping pre-push to fail mode blocks emergency hotfix | Document `git push --no-verify` escape hatch in SOP with audit trail |

## Security Considerations

- `unknown` + zod parse is SAFER than `any` — adds runtime validation
- Link replacements should preserve `rel="noopener noreferrer"` on external links
- No new secrets, no DNS, no auth changes

## Next Steps

- **CRITICAL**: After this phase completes, return to Phase 1 to flip G2 lint from warn→fail
- Phase 4 (Backup) can now run — independent
- Phase 5 (Schema) can now run — independent
- Update `docs/code-standards.md` codifying the new lint-clean baseline
