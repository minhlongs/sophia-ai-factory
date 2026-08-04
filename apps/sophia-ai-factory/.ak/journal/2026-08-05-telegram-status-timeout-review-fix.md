# Journal — Telegram /status Timeout: Post-Review Fixes

**Date:** 2026-08-05
**Plan:** 260804-1102-telegram-status-timeout
**Phase:** Post-review remediation

## What happened

Code-reviewer (a0e43f24d12c) completed after 10 min runtime and returned 12 findings. Two categories of real bugs; rest were pre-existing patterns, dead code, or scope drift that turned out beneficial.

## What changed

1. **getStatusDb/getResultsDb/getCampaignDb** — were throwing on null D1; changed to return null. Callers now check null and send "Database unavailable. Please try again later." This matches the pattern already used by analytics-handler, email-handler, missions-handler, ticket-handler.

2. **route.ts** — 6 raw `throw new Error("D1 database binding not available")` in POST handler replaced with `NextResponse.json({ error: "Database temporarily unavailable" }, { status: 503 })`. Prevents opaque 500 + Telegram retry storms during D1 outages.

3. **campaign-handler.ts** — removed unused `truncate` and `MAX_FIELD_LENGTH`/`TRUNCATION_SUFFIX` constants (dead code from Phase 1 refactor).

## What did NOT change

- `as unknown as ProfileRow` / `as unknown as CampaignRow` casts: pre-existing across all handlers, not introduced by this fix.
- `dynamic = 'force-dynamic'`: acceptable for webhook endpoint.
- `createServerClient` still exported: backward compatibility.
- Protected flows: /campaign, /status, /results all now null-safe.

## Verification

- TypeScript: 0 errors
- Telegram tests: 97/97 pass
- Protected flows: /campaign, /status, /results all null-safe
