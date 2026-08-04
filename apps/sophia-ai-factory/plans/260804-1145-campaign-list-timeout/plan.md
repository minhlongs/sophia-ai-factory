---
title: /campaign list timeout fix
status: completed
priority: P1
effort: small
branch: fix/campaign-list-timeout
tags: [telegram, timeout, campaign]
created: 2026-08-04
---

# /campaign list Timeout Fix — Plan

**Plan ID:** 260804-1145-campaign-list-timeout
**Created:** 2026-08-04
**Completed:** 2026-08-05
**Author:** Sophia Engineering
**Status:** COMPLETED — Phase 1 implemented, verified, synced

## Problem

`/campaign list` times out when users have many campaigns. `handleCampaignList` in `campaign-handler.ts:161` fetches unlimited rows, builds a single long MarkdownV2 string — the same failure class as the `/status` timeout fixed in plan `260804-1102`.

## Fix Approach (mirrors Phase 2 of status fix)

Apply the proven pattern from `status-handler.ts`:
1. Row cap: `MAX_CAMPAIGN_LIST_ROWS = 10` (limit query)
2. Title truncation: `MAX_CAMPAIGN_TITLE_LEN = 80`
3. Message truncation: `MAX_CAMPAIGN_MESSAGE_LEN = 3800` using `truncateMarkdownV2Safely`
4. Use existing `truncateMarkdownV2Safely` utility (already imported in `status-handler.ts`, available in `format-markdown-v2.ts`)

## Files to Modify

- `src/tree/telegram/handlers/campaign-handler.ts` — add caps, use truncation utility, respect message limit

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Apply truncation + row cap to handleCampaignList | Completed |

## Verification Summary

- TypeScript: 0 errors
- Tests: 6778/6778 pass (678 files, 1 skipped, 10 todo)
- Protected flows: `/campaign`, `/status`, `/results` verified
- Plan supersedes: `260804-1200-campaign-list-timeout` (lower row cap + shorter titles)
- Sync-back: plan.md updated to status=completed with YAML frontmatter; phase-01 reconciled
