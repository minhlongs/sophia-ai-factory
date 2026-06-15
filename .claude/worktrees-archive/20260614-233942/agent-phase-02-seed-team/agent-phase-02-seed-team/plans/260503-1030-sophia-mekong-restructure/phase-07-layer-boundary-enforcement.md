# Phase 07 — Layer Boundary Enforcement (ESLint Rule)

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-06-move-land-layer.md](phase-06-move-land-layer.md)
- Files: `apps/sophia-ai-factory/eslint.config.mjs`

## Overview
- **Priority:** P1
- **Status:** COMPLETE (2026-05-03)
- **Effort:** 30m
- **Description:** Add ESLint rule to forbid upward imports (e.g., seed importing tree/forest/land). Rule formalizes layered architecture so future PRs can't break it.

## Key Insights
- `eslint-plugin-boundaries` is the canonical tool — supports element types + dependency rules.
- Alternative: `eslint-plugin-import` with `no-restricted-paths` rule (lighter, no extra dep).
- Direction enforced: `land → forest → tree → seed` (downward only).
- Apply to `src/**/*.{ts,tsx}` — exclude `src/app/**/*` since route files at top can import any layer (they're orchestration).

## Requirements

### Functional
- ESLint config rejects:
  - `src/seed/**` importing `@/tree`, `@/forest`, `@/land`
  - `src/tree/**` importing `@/forest`, `@/land`
  - `src/forest/**` importing `@/land`
- ESLint allows:
  - `src/seed/**` importing internal `@/seed/...`
  - `src/tree/**` importing `@/seed`, `@/tree`
  - `src/forest/**` importing `@/seed`, `@/tree`, `@/forest`
  - `src/land/**` importing anything below
  - `src/app/**` importing any layer (orchestration exception)
- `npm run lint` exits 0 — meaning Phase 03-06 left zero violations

### Non-Functional
- Rule errors must include actionable message: `seed/foo.ts cannot import from tree/. Layer direction is one-way (land → forest → tree → seed).`

## Architecture
```js
// eslint.config.mjs — added rule (using import/no-restricted-paths)
{
  files: ['src/seed/**/*.{ts,tsx}'],
  rules: {
    'import/no-restricted-paths': ['error', {
      zones: [
        { target: 'src/seed', from: 'src/tree', message: 'seed/ cannot import tree/' },
        { target: 'src/seed', from: 'src/forest', message: 'seed/ cannot import forest/' },
        { target: 'src/seed', from: 'src/land', message: 'seed/ cannot import land/' },
      ]
    }]
  }
}
// Repeat per layer. Or use eslint-plugin-boundaries for declarative version.
```

## Related Code Files

### To modify
- `apps/sophia-ai-factory/eslint.config.mjs` — add boundaries config

### Optionally to add
- `apps/sophia-ai-factory/package.json` — add `eslint-plugin-boundaries` if chosen

## Implementation Steps

1. Decide: `eslint-plugin-boundaries` vs `import/no-restricted-paths` (prefer no-restricted-paths to avoid new dep — KISS).
2. Edit `eslint.config.mjs`, add 3 rule blocks (one per layer with restrictions: seed/tree/forest)
3. Run `npm run lint` — if any violations, list them in `reports/phase-07-violations.md` and fix in this same phase
4. Commit: `chore(eslint): enforce mekong layer one-way import direction (land→forest→tree→seed)`

## Todo List

- [x] Choose plugin — used built-in `no-restricted-imports` (no new dep, KISS)
- [x] Edit eslint.config.mjs — 3 layer blocks + exemptions per LOCKED DECISIONS
- [x] Run lint — 0 new `no-restricted-imports` errors
- [x] Fix any straggler violations — all handled by exemption overrides
- [x] Re-run lint until clean — confirmed 0 layer violations
- [x] Commit

## Success Criteria
- `npm run lint` exits 0
- Manually inserted bad import (test) → lint correctly errors with clear message
- CI lint job passes

## Risk Assessment
- **M** Phases 03-06 left undetected upward imports → many violations Phase 07. Mitigation: scout report from Phase 01 already flagged these; should be zero.
- **L** False positives on dynamic imports / `import()` syntax. Mitigation: rule covers static imports only; document dynamic-import policy in Phase 08 doc.
- **L** Test files violate (e.g., seed test imports tree mock). Mitigation: tests live under `src/seed/__tests__/` with same restrictions; OR exempt tests via override block.

## Security Considerations
- None.

## Next Steps
- **Unblocks:** Phase 08 (docs)
