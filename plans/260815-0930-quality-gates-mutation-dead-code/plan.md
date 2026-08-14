# Quality Gates: Mutation Testing, Dead-Code Detection & Circuit Breaker Hardening

## Outcome

Sophia AI Factory gains three quality-gate upgrades:
1. **Knip dead-code detection** — 0 unused exports in production code
2. **Stryker mutation testing** — >80% mutation score on critical financial/security modules
3. **Circuit breaker lazy recovery** — cold cache misses check D1 before allowing requests

## Constraints

- CF-Direct Doctrine: deploy via `npm run deploy:full`, no GitHub Actions
- Protected flows: Setup Wizard, Telegram Bot, NOWPayments must not break
- 4-Layer Architecture: seed→tree→forest→land import rules unchanged
- 6744+ existing tests must continue passing
- Husky pre-push hook integration for new gates

## Non-Goals

- Full Stryker coverage of all 6744+ tests (start with critical modules only)
- Complete codebase dead-code removal in one pass
- Staging environment infrastructure (deferred to P2)
- Architecture rewrite

## Acceptance Criteria

1. `npx knip` runs clean — 0 unused exports (after initial cleanup)
2. `npx stryker run` achieves >80% mutation score on targeted modules
3. `shouldAllowRequest` calls `hydrateFromD1IfNeeded` on cold cache miss
4. `npm test` — all 6744+ tests pass
5. `npm run build` — 0 TypeScript errors
6. `npm run lint` — clean

## Phases

### P1: Knip + Stryker + Circuit Breaker (parallel)
- Install knip, @stryker-mutator/core, @stryker-mutator/vitest-runner
- Create knip.json config
- Create stryker.config.ts for targeted modules
- Wire hydrateFromD1IfNeeded into shouldAllowRequest (async)
- Run both tools to establish baseline

### P2: Fix & Tune
- Fix Knip findings (unused exports)
- Improve Stryker score (add missing tests for survived mutants)
- Update callers of shouldAllowRequest to handle async

### P3: Integration
- Add husky pre-push hooks for knip + stryker
- Document new quality gates
- Update CLAUDE.md quality gates section
