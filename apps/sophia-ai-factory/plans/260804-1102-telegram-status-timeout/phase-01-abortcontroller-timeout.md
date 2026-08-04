# Phase 1 — AbortController Timeout Wrapper

## Context Links
- Journal: `.ak/journal/2026-08-04-telegram-status-timeout-fix.md`
- Related file: `src/tree/telegram/handlers/status-handler.ts`

## Overview
- **Priority:** Medium
- **Current Status:** ABANDONED
- **Description:** Attempt to wrap Telegram API calls with AbortController + timeout to prevent hanging requests. Proved incompatible with Telegraf's `sendMessage` API.

## Key Insights
- Telegraf's `sendMessage` does not accept a `{ signal }` parameter
- TypeScript errors surfaced during implementation, blocking this approach
- Root cause analysis shifted focus to message size rather than API timeout

## Requirements
- Wrap Telegram send operations with AbortController
- Set 10-second timeout on `/status` handler
- Graceful abort handling

## Architecture
- Attempted to inject `AbortSignal` into `bot.telegram.sendMessage(chatId, text, { signal })`
- Telegraf 4.x API rejects unknown options, causing TS compilation errors

## Related Code Files
- **To modify:** `src/tree/telegram/handlers/status-handler.ts` (attempted, abandoned)

## Implementation Steps
1. [ ] Import AbortController in status-handler.ts
2. [ ] Create AbortController with 10s timeout
3. [ ] Pass signal to sendMessage options
4. ~~[ ] Verify with tests~~ → blocked by TS errors

## Todo List
- [x] Research Telegraf AbortController support
- [x] Attempt implementation
- [x] Identify TS incompatibility

## Success Criteria
- NOT MET — Phase abandoned; Telegraf does not support AbortSignal on sendMessage

## Risk Assessment
Blocking risk: HIGH — alternative approach (truncation) found instead

## Security Considerations
N/A — no security implications for abandoned phase

## Next Steps
- Proceed to Phase 2 (truncation-based fix)
- Alternative: defer AbortController to Telegraf upgrade or wrapper layer
