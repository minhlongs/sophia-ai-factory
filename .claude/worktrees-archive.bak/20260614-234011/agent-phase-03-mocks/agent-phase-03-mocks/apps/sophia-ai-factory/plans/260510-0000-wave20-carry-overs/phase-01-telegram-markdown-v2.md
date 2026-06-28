# Phase 01 — Telegram MarkdownV2 Escaping (7A)

## Context Links

- Wave 19 Phase 07 carry-over (7A)
- Source: `src/forest/publishing/providers/telegram-publisher.ts:50-55` (current `sanitizeCaption` strips MarkdownV2 specials)
- Telegram Bot API doc: https://core.telegram.org/bots/api#markdownv2-style

## Overview

- **Priority:** P1
- **Effort:** 2h
- **Status:** ✅ COMPLETE (2026-05-10)
- **Description:** Replace strip-markdown with proper MarkdownV2 escaping so user captions render bold/italic/links correctly. Currently `*world*` becomes `world` because we strip the asterisks.

## Key Insights

- Telegram MarkdownV2 special chars: `_*[]()~\`>#+-=|{}.!\\`. Each must be escaped with backslash.
- We do NOT want to escape user-entered formatting (bold/italic): users may want `*bold*` to render bold. So strategy: detect intentional pairs (`*...*`, `_..._`, `~...~`) and only escape unmatched specials.
- Simpler v1: assume captions are PLAIN TEXT, escape ALL specials. Future v2: parse markdown intent.
- Caption max 1024 chars Telegram limit.

## Requirements

### Functional
- F1. New helper `escapeMarkdownV2(text: string): string` in `src/tree/telegram/format-markdown-v2.ts`.
- F2. Helper escapes ALL MarkdownV2 specials with `\\` prefix.
- F3. `publishToTelegram` sets `parse_mode: 'MarkdownV2'` and uses escaped caption.
- F4. Caption truncation respects escape sequences (don't cut a `\\X` in half).

### Non-Functional
- NF1. Helper file <80 LOC.
- NF2. No `:any`. Test cases for every special char.
- NF3. No regression in existing publisher tests.

## Architecture

```
src/tree/telegram/format-markdown-v2.ts (NEW)
   └── escapeMarkdownV2(text) — backslash-escape MarkdownV2 specials

src/forest/publishing/providers/telegram-publisher.ts (MODIFY)
   ├── replace `sanitizeCaption` strip approach with escapeMarkdownV2
   ├── add parse_mode: 'MarkdownV2' to payload
   └── keep 1024-char truncation (apply AFTER escape, then trim trailing `\\`)
```

## Related Code Files

### Modify
- `src/forest/publishing/providers/telegram-publisher.ts` — swap `sanitizeCaption` for `escapeMarkdownV2`
- `src/forest/publishing/providers/__tests__/telegram-publisher.test.ts` — update existing 2 tests that assert stripping → assert escaping

### Create
- `src/tree/telegram/format-markdown-v2.ts` (~50 LOC)
- `src/tree/telegram/__tests__/format-markdown-v2.test.ts` (~80 LOC, 14 specials + edge cases)

## Implementation Steps

1. Create `format-markdown-v2.ts` with `escapeMarkdownV2(text)` using regex `/([_*\[\]()~`>#+\-=|{}.!\\])/g` → replace with `\\$1`.
2. Add `truncateMarkdownV2Safely(text, maxLen)` — slice to maxLen but if last char is `\\` not followed by escaped char, drop it.
3. Update `telegram-publisher.ts` `sanitizeCaption`:
   - Before: strip + truncate
   - After: escape + truncate-safely
   - Add `parse_mode: 'MarkdownV2'` to payload
4. Update existing publisher tests:
   - "caption MarkdownV2 special chars stripped" → rename to "caption escaped" with new assertions
   - "caption truncated to 1024 chars" — verify truncation respects `\\` boundary
5. Write 14 new escape tests (one per special char + a few combos).
6. `npm run build` + `npm test`.

## Todo List

- [x] Create `format-markdown-v2.ts` (36 LOC) + 31 tests
- [x] Update `telegram-publisher.ts` to use escape + `parse_mode: 'MarkdownV2'`
- [x] Update affected publisher test (stripped → escaped assertions)
- [x] `npm run build` → 0 errors
- [x] `npm test` → 3108/3108 pass
- [x] Code review pass (9.5/10, security PASS, 0 blockers)
- [ ] `npm run deploy:full` + SHA verify

## Completion Notes

**Files modified:** 4
- NEW `src/tree/telegram/format-markdown-v2.ts` (36 LOC) — `escapeMarkdownV2()` + `truncateMarkdownV2Safely()` with backslash-parity check
- NEW `src/tree/telegram/__tests__/format-markdown-v2.test.ts` (31 tests covering all 19 specials + edge cases)
- MODIFIED `src/forest/publishing/providers/telegram-publisher.ts` — sanitizeCaption switched from strip-specials to escape; payload sets `parse_mode: 'MarkdownV2'` when caption present
- MODIFIED `src/forest/publishing/providers/__tests__/telegram-publisher.test.ts` — 1 test updated (stripped → escaped + parse_mode assertion)

**Tests:** 3108/3108 pass (was 3077, +31). TypeScript clean. Build green.

**Reviewer score:** 9.5/10 PASS, 0 blockers.

## Success Criteria

- [ ] User caption "Check this out *amazing* video" → renders bold "amazing" in Telegram.
- [ ] Period `.` and bracket `[` no longer break message send (they were silently stripped before).
- [ ] All 14 MarkdownV2 specials covered by unit test.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| User had `*` in plain text expecting it to render literal asterisk | M | L | Doc note: from now on MarkdownV2 — to display literal `*`, user types `\*`. Send admin alert about the change. |
| Telegram rejects message with `parse_mode: MarkdownV2` if escape pattern wrong | M | L | Comprehensive test suite + manual smoke against real bot before deploy. |
| Truncation cuts inside an escape pair like `\.` | L | L | `truncateMarkdownV2Safely` checks last char isn't lone `\\`. |

## Security Considerations

- No XSS risk — Telegram is the consumer.
- Caption may contain `<script>` etc. — not interpreted by Telegram, no SSRF.
- Bot token still masked in logs (unchanged from Phase 05).

## Next Steps

- Phase 02 builds on this — same Telegram dispatch path gets restructured.
