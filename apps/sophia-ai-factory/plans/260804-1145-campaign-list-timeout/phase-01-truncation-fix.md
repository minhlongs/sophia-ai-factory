# Phase 1 — Truncation + Row Cap for /campaign list

## Overview
- **Priority:** High — matches already-verified `/status` fix
- **Status:** Complete
- **Description:** Apply the proven Phase 2 pattern from plan `260804-1102` to `handleCampaignList`

## Key Insights
- Identical bug class: unbounded row fetch + unbounded message string
- `truncateMarkdownV2Safely` already imported at `campaign-handler.ts:8`
- Pattern validated: 27/27 telegram tests, 137/137 video tests, 0 TS errors

## Requirements
- Row cap: 10 campaigns max
- Title truncation: 80 chars
- Message truncation: 3800 chars with safe MarkdownV2 footer
- Preserve zero-` :any` types
- Preserve `CampaignRow` interface

## Architecture
Same as `status-handler.ts` Phase 2: constants at module top, cap query `.limit()`, truncate each field, bound total message length, footer note when truncated.

## Related Code Files
- **Modify:** `src/tree/telegram/handlers/campaign-handler.ts`
- **No new files.**

## Implementation Steps
1. Replace hard-coded `MAX_CAMPAIGN_LIST_ROWS`/`MAX_CAMPAIGN_TITLE_LEN`/`MAX_CAMPAIGN_MESSAGE_LEN` block
2. Use `truncateMarkdownV2Safely` on title and total message
3. Add `...(truncated)` footer when message hits cap

## Code Review Findings (post-commit cleanup)

| Severity | Finding | Action |
|----------|---------|--------|
| MEDIUM | `escapeMarkdownV2` imported but never used — copy-paste residual from `status-handler.ts` | Removed from import |
| LOW | Dead `truncate()` helper + `MAX_FIELD_LENGTH`/`TRUNCATION_SUFFIX` constants (lines 155–161) — never called; `truncateMarkdownV2Safely` used inline instead | Removed |
| LOW | No comment explaining why row cap is 10 vs. prior 20 — future maintainer might "normalize" to 20 and re-introduce timeout | Added timeout rationale comment above constant |

Review verdict: **Approved** — no side effects, no regression to cancel/creation flows, public contract preserved.

## Success Criteria
- Type-check clean ✅
- All existing tests pass (especially telegram campaign tests) ✅
- `/campaign list` no longer times out with many campaigns ✅
- Zero dead code / unused imports ✅
- Timeout rationale documented at call site ✅
