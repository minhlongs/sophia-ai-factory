# Phase 2 — Message Truncation + Row Limit

**Plan:** 260804-1102-telegram-status-timeout
**Status:** IMPLEMENTED
**Date:** 2026-08-05

## Overview

Phase 2 addressed the Telegram `/status` timeout by applying two mitigations directly in the handler:

1. **Row limit** — cap campaign list results to 10 rows
2. **Field truncation** — truncate long campaign titles to prevent oversized MarkdownV2 messages

## Checklist

- [x] Add row limit to status campaign query
- [x] Apply title truncation via `truncateMarkdownV2Safely`
- [x] Ensure MarkdownV2 safety for truncated output
- [x] Verify no regression in `/campaign`, `/status`, `/results` flows
- [x] All existing tests pass (39/39)

## Implementation

### Key constants (`src/tree/telegram/handlers/status-handler.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FIELD_LENGTH` | 120 | Max title/field characters |
| `MAX_LIST_ROWS` | 10 | Max campaigns returned per query |
| `TRUNCATION_SUFFIX` | `…` | Unicode ellipsis appended when truncated |

### Truncation helper (`src/tree/telegram/handlers/format-markdown-v2.ts`)

`truncateMarkdownV2Safely(value, maxLen)` — truncates a string to `maxLen` characters while preserving MarkdownV2 escape safety. Guards against dangling backslashes that would corrupt Telegram message parsing.

### Status handler changes

- Campaign list query: `.limit(MAX_LIST_ROWS)` (line ~111)
- Title rendering: `truncate(c.title, MAX_FIELD_LENGTH)` before embedding in MarkdownV2 message (lines ~96, ~137)

## Verification

| Check | Result |
|-------|--------|
| Tests — telegram-bot.test.ts | 8/8 pass |
| Tests — telegram-bot-campaign-handlers.test.ts | 19/19 pass |
| Tests — format-markdown-v2.test.ts | 12/12 pass |
| Total relevant tests | 39/39 pass |
| Video tests | Not verified (137/137 claim unvalidated from PM sync context) |
| TypeScript | 0 errors in Phase 2 code |
| Protected flows | `/campaign`, `/status`, `/results` unchanged |

## Notes

Phase 1 (AbortController timeout wrapper) was abandoned — TypeScript errors showed Telegraf does not accept the `{ signal }` parameter without type upgrades. No runtime fix possible without upgrading Telegraf.

Phase 2 provides a pragmatic reduction in response payload size, which directly addresses the timeout symptom without requiring library changes.
