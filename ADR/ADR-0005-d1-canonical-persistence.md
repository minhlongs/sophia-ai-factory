# ADR-0005 — D1 Is Canonical Production Persistence

**Status:** Accepted  
**Date:** 2026-06-18  
**Owner:** CTO

## Context

Sophia production persistence is Cloudflare D1. Supabase exists for historical/shared exceptions such as OAuth callbacks, not as the primary Sophia schema source.

## Decision

Use D1 as the canonical Sophia production database. Supabase is an exception path only when explicitly required by a legacy flow.

## Consequences

- Migrations live under `apps/sophia-ai-factory/migrations/`.
- DB access uses `createServerClient()` from `@/seed/db/client` without await.
- Supabase assumptions must not drive Sophia schema design.

## Evidence

- [`README.md`](README.md#L28-L38) — Cloudflare Workers and D1 stack.
- [`apps/sophia-ai-factory/CLAUDE.md`](apps/sophia-ai-factory/CLAUDE.md#L1-L89) — DB client and persistence rules.
- [`ARCHITECTURE.md`](ARCHITECTURE.md#L22-L31) — layer model and D1 as primary persistence.
