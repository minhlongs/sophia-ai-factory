# Code Review — Phase 8 (Telegram Handlers `:any` + Phase 7 Nits)

**Date:** 2026-04-20
**Reviewer:** code-reviewer agent
**Scope:** 7 files, `:any` cleanup + log-message standardization
**Verdict:** **APPROVE_WITH_NITS — 9.2/10**

---

## Summary

Clean, surgical cleanup. `db.from<T>()` generic usage is correct (signature confirmed at `d1-query-builder.ts:374` — `from<T = Record<string, unknown>>`). All 6 handler `:any` occurrences eliminated (grep on `src/lib/telegram/handlers/*.ts` returns 0). FSM comma-ternary correctly refactored to explicit `if/else`; logger dead-code path removed; null-safe `createError?.message ?? 'Unknown error'` is idiomatic.

## Critical Issues
None.

## Nits

1. **`sql-rate-limiter.ts:68` still has `[metric]` prefix** — Plan claimed "2 warn messages fixed", only L41 was cleaned. L68 (`logger.warn('[metric] telegram_ratelimit_fail_open', ...)`) still carries redundant prefix. Drop to match Phase 7 fix intent.
2. **Row interfaces under-declared** — `CampaignRow` in `results-handler.ts` omits `id`, `status`, `user_id` which exist on the table. Fine for current usage (only `title`/`video_url`/`updated_at` read) but flag for future expansion; consider a shared `CampaignRow` in a types module.
3. **`as unknown as ProfileRow` double-cast** (`results-handler.ts:28`, `status-handler.ts:43`) — justified because `profileData` arrives as `Record<string, unknown>` from upstream `.single()`, but a shared `ProfileRow` type + single-cast in the query-builder shim would eliminate the pattern.

## Strengths

- Zero `:any` / `as any` in all 13 handler files (verified by grep).
- Log scraper safety: no tests or src code grep the old `[metric]` prefix or old `Invalid BotState in D1` message — backward compat preserved.

## Backward Compat
No public API changes. Structured log keys (`metric:`) retained — downstream aggregators query by key, not prefix.

## Unresolved Questions
- Should `ProfileRow` / `CampaignRow` move to a shared `src/lib/telegram/types.ts` to avoid duplication across 3 handlers? (Defer to Phase 9.)
