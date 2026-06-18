# ADR-0002 — Four-Layer Architecture Is Canonical

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CTO

## Context

Sophia code uses a four-layer model: `seed`, `tree`, `forest`, `land`. Historical `src/lib/*` modules remain, but canonical imports have been consolidated.

## Decision

New code must use the four-layer model. `seed` is foundational, `tree` is domain-reusable, `forest` is infrastructure orchestration, and `land` is business workflow ownership. Forest may call land for orchestration; land must not import forest back.

## Consequences

- Auth, DB, tier config, and UI primitives live in `seed`.
- Banned imports remain: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`.
- Refactors must preserve or improve import direction, not just move files.

## Evidence

- [`apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`](apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md#L1-L70) — four-layer model and import direction.
- [`apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md`](apps/sophia-ai-factory/.claude/rules/cross-layer-orchestration.md#L1-L68) — forest→land orchestration exception and forbidden directions.
