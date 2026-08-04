---
title: /campaign list timeout fix
status: superseded
priority: P1
effort: small
branch: fix/campaign-list-timeout
tags: [telegram, timeout, campaign]
created: 2026-08-04
superseded_by: 260804-1145-campaign-list-timeout
---

# /campaign list timeout fix

## Problem
Telegram `/campaign list` times out for users with many campaigns. `handleCampaignList` builds unbounded Markdown messages (20 campaigns, full-length titles), causing slow Telegram API round-trips through the 2-attempt retry flow.

## Root cause
- File: `src/tree/telegram/handlers/campaign-handler.ts:156`
- `handleCampaignList` emits up to 20 full-length campaign rows
- No truncation on title or message length
- Same failure class as the already-fixed `/status` handler

## Fix
Apply the same truncation + row-cap pattern from plan `260804-1102`:
- Row cap: keep existing `limit(20)`
- Truncate titles via `truncateMarkdownV2Safely` (max 120 chars)
- Add overall message length guard (~3800 chars to stay under Telegram's 4096 safe limit)

## Files changed
- `src/tree/telegram/handlers/campaign-handler.ts` (modify)

## Verification
- All 6778 tests pass
- 0 TypeScript errors
- `/campaign`, `/status`, `/results` protected flows verified

## Phases
- Phase 1: Implement truncation fix
