# PRD — Y3 Tech Debt Sprint
**Migration Consolidation + Layer Enforcement CI**

**Date:** 2026-07-16
**Stage:** PMF→Early Scale
**Owner:** Engineering team + AI agents

---

## Vision

> A Sophia codebase where migrations are deterministic, layer boundaries are enforced by CI not convention, and documentation is authoritative. Engineers and agents ship features without fear of breaking deployment or architecture invariants.

Vietnamese: Một codebase nơi migrations luôn deterministic, layer boundaries được enforce bởi CI (không phải convention), và documentation là authoritative. Engineers và agents ship features mà không sợ break deployment.

---

## Target Users (ICP)

| Role | Profile | Trigger |
|------|---------|---------|
| **Primary: Engineer** | Fullstack dev, familiar with Next.js + CF Workers, 2-4 yrs experience | About to add a new migration → discovers numbering chaos → loses confidence |
| **Secondary: AI Agent** | Kongming, planner, fullstack-developer subagent | Scouting codebase → hits conflicting ARCHITECTURE.md → wastes context |
| **Tertiary: Non-tech CEO** | Bill's client, AI video SaaS buyer | Experiences downtime from schema error → loses trust → churns |

**Jobs-to-be-Done:**
1. "I need to add a database migration and know exactly which number comes next."
2. "I want to review a PR and instantly verify it doesn't violate layer boundaries."
3. "I need to understand the architecture without reading 10 competing docs."

---

## Core Features (YAGNI)

| Feature | Description | Complexity | Priority |
|---------|-------------|-----------|----------|
| **F1: Migration Audit Script** | Bash/TS script that compares filesystem migrations to D1 applied state. Reports duplicates, gaps, conflicts. | Low | P0 |
| **F2: Migration Consolidation** | Deduplicate `migrations/` and `apps/.../migrations/` into canonical path. Renumber gaps. | Medium | P0 |
| **F3: Layer Import Checker** | TS script: given a source file, verify all imports obey 4-layer rules. Output: PASS/FAIL + violation list. | Medium | P1 |
| **F4: CI Integration** | Add layer check to `npm run ci`. Warning mode Sprint 1, error mode Sprint 2. | Low | P1 |
| **F5: Docs Cleanup** | Archive 30+ root MD files. Resolve ARCHITECTURE.md conflict. Add INDEX.md. | Low | P2 |
| **F6: Migration Apply Verification** | Enhanced `apply-migrations.sh` with pre-flight check (audit script) + SHA verification | Low | P0 |

**Out of Scope (YAGNI):**
- Programmatic migration renumbering that rewrites D1 history (too risky)
- Real-time migration linting in IDE (vim/VS Code extension — over-engineering)
- Automated layer violation auto-fix (humans should decide each fix)

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **North Star:** Deployment reliability | Unknown (no tracking) | 99.9% successful deploys/month | Track via deploy-with-sha.sh success rate + D1 migration apply errors |
| **KPI 1:** Migration duplication count | 2-3 duplicates observed | 0 duplicates | audit-migrations.sh report |
| **KPI 2:** Layer violation count | Unknown (no tracking) | 0 violations in CI (error mode) | layer-import-check.ts output |
| **KPI 3:** Time-to-understand-architecture | ~30 min (docs scattered) | <10 min | Survey: engineer time to answer "how does a request flow from API to DB?" |

---

## Agentic Architecture

| Agent Role | Task | Tool Access |
|------------|------|-------------|
| **Explorer (Phase 1)** | Audit migration directories, identify duplicates, map to D1 state | Read, Bash (wrangler d1) |
| **Fullstack-dev (Phase 1)** | Execute consolidation: dedupe, renumber, verify | Write, Edit, Bash |
| **Planner (Phase 2)** | Design layer enforcement rules, define allowlist | Read, Glob, Grep |
| **Fullstack-dev (Phase 2)** | Implement check script, integrate into CI | Write, Edit, Bash |
| **Code-reviewer (all phases)** | Verify changes against 4-layer rules, check for regressions | Read, Grep, Bash |
| **Tester (all phases)** | Run full test suite (844+ tests), verify 0 failures | Bash (vitest, build) |

**Execution model:** Sequential phases (Phase 1 → Phase 2 → Phase 3), but within each phase, agents can run in parallel on independent subtasks.

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Migration audit | Bash + TS | Leverages existing `wrangler d1` CLI; no new dependencies |
| Layer check | TypeScript | Consistent with codebase; can import AST parsers if needed |
| CI integration | npm script + existing CI | No new infra — extend `npm run ci` |
| Docs | Markdown | Existing convention |
| Testing | Vitest (existing) | Verify no regressions in 844+ test suite |

**No new dependencies required.** All tools exist in current toolchain.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **R1: Migration renumber breaks deployed schema** | MEDIUM | HIGH | DO NOT renumber applied migrations. Use D1 state as source of truth. Test on staging D1 first. |
| **R2: Layer check false positives block CI** | HIGH (if rushed) | MEDIUM | Warning mode Sprint 1. Build allowlist for edge cases before promoting to error. |
| **R3: Docs archive breaks cross-references** | LOW | LOW | Grep for internal links before archiving. Add INDEX.md with old→new path mapping. |
| **R4: Consolidation takes longer than estimated** | MEDIUM | LOW | Timeboxed: 4h hard limit. If not done, split into Part A (audit + report) and Part B (fix next sprint). |

---

## Implementation Order

```
Day 1 (4h): Phase 1 — Migration Consolidation
  ├─ 1h: Audit script (F1) + run against current state
  ├─ 2h: Consolidate migrations (F2) + verify with staging D1
  └─ 1h: Enhance apply script (F6) + test

Day 2 (8h): Phase 2 — Layer Enforcement (or split across 2 days)
  ├─ 2h: Design rules + allowlist (F3 design)
  ├─ 3h: Implement check script
  ├─ 1h: CI integration (F4)
  └─ 2h: Fix existing violations + verify tests pass

Day 2 (+1h): Phase 3 — Docs Cleanup (parallelizable)
  ├─ 30min: Archive root MD files (F5)
  ├─ 15min: Resolve ARCHITECTURE.md conflict
  └─ 15min: Add INDEX.md
```

---

## Alignment with Existing Docs

| Existing Doc | Alignment |
|-------------|-----------|
| `CLAUDE.md` — 4-layer model | **Directly enforced** by Phase 2 CI gate |
| `CLAUDE.md` — Canonical import paths | Phase 2 check script validates these |
| `.claude/rules/sophia-layer-architecture.md` | Phase 2 turns these rules into executable checks |
| `docs/ARCHITECTURE.md` | Phase 3 resolves conflict with root canonical version |
| ADR-0002 (4-layer architecture) | Phase 2 operationalizes this ADR |

---

## Unresolved Questions

1. **D1 migration state:** Has D1 applied both `004` and `0004`? Need `wrangler d1 migrations list sophia-db` to determine consolidation strategy.
2. **Layer allowlist:** Which existing files need exemption? (e.g., `src/lib/` migration debt, test utilities)
3. **CI provider:** What CI system runs `npm run ci`? (GitHub Actions disabled — is there another CI, or is this local-only?)
