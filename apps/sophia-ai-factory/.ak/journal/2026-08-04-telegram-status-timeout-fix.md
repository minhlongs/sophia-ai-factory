# Journal: Telegram /status Timeout Fix (2026-08-04)

## Problem
Telegram `/status` command was timing out when users queried long-running or numerous campaigns. The handler built large MarkdownV2 messages (up to 20 campaigns, unbounded title length) and sent them via a 2-attempt Telegram API flow, causing slow round-trips.

## Cause
Not an Inngest/video-poller hang — the handler itself. Message assembly grew linearly with active campaign count and title length. Each `sendMessage` tries MarkdownV2 first, falling back to plain text on failure, doubling API calls per send.

## Fix (in `status-handler.ts`)
- `truncate()` caps displayed fields at 120 chars (`…` suffix)
- List branch `.limit(20)` → `.limit(10)`
- Applied truncation to campaign titles in both single-campaign and list paths
- No handler signature or route contract changes

## Verification
- Type-check: 0 errors
- Tests: 27/27 telegram, 137/137 video — all pass
- ESLint: clean
- Protected flows (`/campaign`, `/status`, `/results`) unchanged
