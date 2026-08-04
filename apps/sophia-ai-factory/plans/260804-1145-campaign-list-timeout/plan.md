# /campaign list Timeout Fix — Plan

**Plan ID:** 260804-1145-campaign-list-timeout
**Created:** 2026-08-04
**Author:** Sophia Engineering
**Status:** In Progress

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

## Completion

- **File modified:** `src/tree/telegram/handlers/campaign-handler.ts`
- **Change:** Row cap (10), per-title truncation (80 chars via `truncateMarkdownV2Safely`), message truncation (3800 chars), footer when truncated
- **Verification:** type-check 0 errors, tests pass, code review approved
- **Pattern source:** `plan 260804-1102` (status fix, committed as `2752fa59`)
- **Dead code removed:** unused `escapeMarkdownV2` import, local `truncate()` helper + `MAX_FIELD_LENGTH`/`TRUNCATION_SUFFIX` constants
- **Review fix:** Added timeout rationale comment above `MAX_CAMPAIGN_LIST_ROWS`
- **Date completed:** 2026-08-04
- **Status:** `completed`
