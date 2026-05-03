---
title: "Sophia AI Factory: Mekong 4-Layer Restructure"
description: "Migrate apps/sophia-ai-factory/src/* into seed/tree/forest/land layered architecture with strict one-way import direction."
status: pending
priority: P2
effort: 7h
branch: main
tags: [refactor, architecture, mekong, layering, sophia]
created: 2026-05-03
---

# Sophia AI Factory: Mekong 4-Layer Restructure

Restructure `apps/sophia-ai-factory/src/` (1646 TS files, 102 lib subdirs) from flat Next.js layout into mekong 4-layer architecture: **seed → tree → forest → land**, with one-way import direction (down only). Each phase atomic + revertable. Production stays GREEN throughout.

**Reference:** `~/mekong-cli/plans/260425-1850-solo-platform-restructure/` (4-phase complete).

## Locked Architectural Decisions (2026-05-03 post-Phase-01 scout)

Based on scout findings (1717 files, ~28 true violations, PR #23):

1. ✅ **`components/ui/` stays in seed** — pure Tailwind primitives, zero domain imports. Mekong-aligned.
2. ✅ **Extract billing types to `seed/types/billing-contracts.ts`** — fixes 56 forest→land violations by exposing contracts at seed layer. Adds ~1h to Phase 02.5.
3. ✅ **`lib/auth/` cluster KEPT in seed** — including enriched-jwt et al. ESLint config will EXEMPT `lib/auth/*` from forest-import rule. ~4 acceptable violations.
4. **New Phase 02.5 (pre-fix violations)** added between Phase 02 and Phase 03 — fixes ~28 true seed violations BEFORE any file moves. Gating.

## Layer Definitions (one-way: land → forest → tree → seed)

| Layer | Purpose | Sophia Mapping (tentative) |
|-------|---------|----------------------------|
| **seed/** | Infra primitives, no domain | db/, types/, config/, utils/, security/, lib/agents/base*, lib/health/, better-auth-* |
| **tree/** | Single-tenant CEO ops | setup-wizard/, lib/handover/, lib/telegram/, dashboard/admin/, agent personas |
| **forest/** | Multi-tenant SaaS plumbing | lib/outbox/, api-keys/, email/, onboarding/, quota/, usage-metering/, tenant-isolation, api/v1/api-keys/, api/welcome/ |
| **land/** | Revenue + governance | lib/billing/, lib/payments/, lib/status/, pricing/, status/, checkout/, api/payos/, api/nowpayments/, api/status.json/ |

## Phases

| # | Phase | Effort | File | Status |
|---|-------|--------|------|--------|
| 01 | Scout + dependency analysis | 45m | [phase-01-scout-dependency-analysis.md](phase-01-scout-dependency-analysis.md) | pending |
| 02 | TypeScript path alias setup | 30m | [phase-02-typescript-path-aliases.md](phase-02-typescript-path-aliases.md) | **COMPLETE** (commit 9cf59d29, PR #24, merged main) |
| 02.5 | Pre-fix violations | 1h | (embedded in phase-02) | **COMPLETE** (same commit 9cf59d29) |
| 03 | Move seed/ layer | 90m | [phase-03-move-seed-layer.md](phase-03-move-seed-layer.md) | **COMPLETE** (branch mekong-phase-03-move-seed, PR pending) |
| 04 | Move tree/ layer | 90m | [phase-04-move-tree-layer.md](phase-04-move-tree-layer.md) | pending |
| 05 | Move forest/ layer | 90m | [phase-05-move-forest-layer.md](phase-05-move-forest-layer.md) | pending |
| 06 | Move land/ layer | 90m | [phase-06-move-land-layer.md](phase-06-move-land-layer.md) | pending |
| 07 | Layer boundary enforcement (ESLint) | 30m | [phase-07-layer-boundary-enforcement.md](phase-07-layer-boundary-enforcement.md) | pending |
| 08 | Documentation update | 30m | [phase-08-documentation-update.md](phase-08-documentation-update.md) | pending |
| 09 | Production deploy + verify | 45m | [phase-09-production-deploy-verify.md](phase-09-production-deploy-verify.md) | pending |

## Top Risks (H/M/L)

- **H** Cross-layer imports (seed importing tree) — must detect Phase 01, refactor BEFORE moves
- **H** Test imports breaking — `__tests__/` files must move with source OR adopt `@/seed/...` paths
- **M** Build cache (`.next/`, `.open-next/`) corruption between moves — clear after every phase
- **M** Cypress/Playwright fixture hardcoded paths
- **L** Codegen scripts referencing old paths (`generate-supabase-migrations-manifest.mjs`)

## Mandates (NON-NEGOTIABLE)

1. `git mv` only — preserves history
2. NO barrel re-export shims at old locations (anti-YAGNI per dev-rules)
3. Build + tests pass before next phase
4. Production GREEN verified at end (Phase 09)
5. 0 `:any` types maintained
6. Each phase = ONE atomic commit, independently revertable
