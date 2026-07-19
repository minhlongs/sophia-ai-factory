---
title: "Phase 01 — Wave 20 Carry-overs"
description: "Telegram MarkdownV2, retry_after, quota widget, account self-service, schema rename"
status: completed
priority: P1
effort: 14h
phase: 01
depends_on: []
blocks: []
---

# Phase 01: Wave 20 Carry-overs

## Overview

Ship 5 deferred items từ Wave 19 (7A/7B/7C/7F) + Wave 18 schema cleanup. Source plan: `plans/260510-0000-wave20-carry-overs/plan.md`.

## Key Insights

- **MarkdownV2** yêu cầu escape tất cả ký tự đặc biệt: `_ * [ ] ( ) ~ > # + - = | { } . !`
- **retry_after** là parameter từ Telegram API khi rate limit — cần honor thay vì retry cứng
- **Quota widget** hiển thị trong sidebar — đọc từ D1 subscriptions + usage_meters
- **Account export** — GDPR compliance, user tự export data của mình
- **schema rename** — `publishing_jobs.video_job_id` → `video_id` (breaking, cần migration)

## Files to Modify

| File | Action | Phase |
|------|--------|-------|
| `src/tree/telegram/telegram-message-builder.ts` | Add MarkdownV2 escape util | 01 |
| `src/tree/telegram/telegram-bot-handler.ts` | Apply MarkdownV2 formatting to all messages | 01 |
| `src/tree/telegram/telegram-retry-handler.ts` | Honor retry_after from 429 responses | 02 |
| `src/forest/components/license/usage-meter.tsx` | Quota widget for sidebar | 03 |
| `src/app/api/account/export/route.ts` | Account data export endpoint | 04 |
| `src/app/[locale]/dashboard/settings/` | Change-email UI + server action | 04 |
| `migrations/` | Rename video_job_id → video_id | 05 |

## Architecture

```
Phase 01 (MarkdownV2) ──► Phase 02 (retry_after)  ← both Telegram, same module
                               │
                               ▼
                          Phase 03 (quota widget) ── independent
                          Phase 04 (account self-service) ── independent
                          Phase 05 (schema rename) ── independent
```

## Implementation Steps

### Step 1: MarkdownV2 Escape Utility
- Tạo `src/tree/telegram/telegram-markdown-escape.ts`
- Export function `escapeMarkdownV2(text: string): string`
- Escape: `_ * [ ] ( ) ~ > # + - = | { } . !`
- Unit test: verify tất cả ký tự được escape

### Step 2: Apply MarkdownV2 to Bot Messages
- Update `telegram-bot-handler.ts` — tất cả message dùng `parse_mode: 'MarkdownV2'`
- Wrap text content qua `escapeMarkdownV2()` trước khi gửi
- Giữ backward compat: fallback về plain text nếu MarkdownV2 parse fail

### Step 3: retry_after Honor
- Update `telegram-retry-handler.ts`
- Parse `retry_after` từ 429 response header
- Sleep đúng số giây Telegram yêu cầu trước khi retry
- Max wait: 60s (nếu retry_after > 60s → exponential backoff thay thế)

### Step 4: Quota Widget
- Tạo widget hiển thị usage trong sidebar
- Data source: D1 `subscriptions` + `usage_meters`
- Hiển thị: X/Y credits used, tier name, progress bar
- Responsive, bilingual (vi/en)

### Step 5: Account Export
- Tạo `POST /api/account/export` — authenticated
- Collect: user profile, subscriptions, campaigns, payment history
- Return JSON (không cần CSV — KISS)
- Log audit trail

### Step 6: Change Email UI
- Server action: validate email, send verification, update after confirm
- UI: simple form với current email + new email + confirm button
- i18n: vi/en labels

### Step 7: Schema Rename
- Migration: `ALTER TABLE publishing_jobs RENAME COLUMN video_job_id TO video_id`
- Update all references in `src/`
- Verify build + tests

## Todo List

- [x] 01a: Tạo `telegram-markdown-escape.ts` + unit tests
- [x] 01b: Apply MarkdownV2 to all bot messages
- [x] 02a: Honor retry_after in retry handler + tests
- [x] 03a: Build quota widget component + integrate vào sidebar
- [x] 03b: i18n cho quota widget (vi/en)
- [x] 04a: Account export endpoint + audit log
- [x] 04b: Change-email UI + server action + i18n
- [x] 05a: Schema migration + update all references
- [x] Run `npm test` — all pass
- [x] Run `npm run build` — 0 errors (pre-existing analytics chart errors only)
- [x] Run `npm run lint` — 0 new errors

## Success Criteria

- Telegram bot messages render with proper formatting (bold, italic, links)
- retry_after honored — không spam Telegram API khi rate limited
- Sidebar shows live quota widget for authenticated users
- Account export returns complete JSON
- Change email flow works end-to-end
- Schema rename migration applies cleanly
- All existing tests pass (6525+)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MarkdownV2 escape thiếu ký tự | Medium | High | Comprehensive unit test mọi ký tự đặc biệt |
| retry_after parse fail | Low | Medium | Default về 30s nếu parse fail |
| Quota widget D1 query chậm | Low | Medium | Cache 60s, query nhẹ (single row) |
| Schema rename bỏ sót reference | Medium | High | Global grep + type-check + test suite |
| Account export expose sensitive data | Low | High | Audit trail + scope limit (chỉ data của user đó) |

## Security Considerations

- Account export: verify user identity, chỉ export data của chính user đó
- Change email: verify new email ownership trước khi update
- Telegram messages: không leak PII trong message content
- Schema migration: backup D1 trước khi apply

## Next Steps

- Track 02 (Usage Metering API Gateway) — independent, parallel
- Track 03 (Campaign Analytics v2) — independent, parallel
