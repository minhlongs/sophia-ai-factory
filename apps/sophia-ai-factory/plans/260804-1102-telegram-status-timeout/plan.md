---
id: 260804-1102-telegram-status-timeout
name: Telegram /status Timeout Fix
created: 2026-08-04
completed: 2026-08-05
status: COMPLETED
---

# Telegram /status Timeout Fix — Plan Overview

**Plan ID:** 260804-1102-telegram-status-timeout
**Created:** 2026-08-04
**Author:** Sophia Engineering
**Status:** COMPLETED — Phase 1 abandoned (Telegraf incompatibility), Phase 2 implemented (truncation + row limit), post-review fixes applied and verified (97/97 tests pass, 0 TS errors)

## Problem

Telegram `/status` command timed out when users queried long-running or numerous campaigns. Handler built large MarkdownV2 messages (up to 20 campaigns, unbounded title length), causing slow round-trips via 2-attempt Telegram API flow.

## Phases

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| Phase 1 | AbortController timeout wrapper | ABANDONED | Telegraf `sendMessage` does not accept `{ signal }`. No runtime fix without upgrading Telegraf. See `phase-01-abortcontroller-timeout.md`. |
| Phase 2 | Message truncation + row limit | COMPLETED | Row cap (10) + title truncation (120 chars) reduce MarkdownV2 payload. See `phase-02-truncation-fix.md`. |

## Scope expansion (post-review fix — 2026-08-05)

Post-review remediation extended null-safe D1 handling to all protected Telegram handlers:
- `campaign-handler.ts` — `/campaign` create, list, cancel flows
- `results-handler.ts` — `/results` command
- `route.ts` — 6 raw `throw` replaced with HTTP 503 to stop Telegram retry storms

## Key Files

- **Modified:** `src/tree/telegram/handlers/status-handler.ts` (row limit + truncation)
- **Modified:** `src/tree/telegram/handlers/campaign-handler.ts` (null-safe D1, dead code removed)
- **Modified:** `src/tree/telegram/handlers/results-handler.ts` (null-safe D1)
- **Modified:** `src/app/api/webhooks/telegram/route.ts` (HTTP 503 on D1 unavailable)
- **Journal:** `.ak/journal/2026-08-05-telegram-status-timeout-review-fix.md`

## Verification

- TypeScript: 0 errors
- Telegram tests: 97/97 pass
- Protected flows null-safe: `/campaign`, `/status`, `/results`, `/analytics`, `/email`, `/missions`, `/ticket`
- Pre-existing anomaly: `src/app/actions/campaigns-tier-integration.test.ts:162` — 1 failure ("PREMIUM user multi-channel campaign"). Not caused by this fix.

## Linked Documents

- [Phase 1 — AbortController Timeout](phase-01-abortcontroller-timeout.md)
- [Phase 2 — Truncation Fix](phase-02-truncation-fix.md)
- [Post-Review Fix Report](reports/post-review-fix-report.md)
- [Progress Report](reports/progress-report.md)
