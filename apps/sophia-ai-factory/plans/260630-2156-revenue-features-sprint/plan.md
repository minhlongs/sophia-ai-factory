---
title: "Revenue Features Sprint — 3-Track Parallel"
description: "Wave 20 carry-overs + Usage Metering API Gateway + Campaign Analytics v2. 3 track độc lập, --deep --parallel."
status: completed
priority: P1
effort: 3-4d
branch: main
tags: [revenue, dashboard, analytics, telegram, usage-metering, campaign]
created: 2026-06-30
---

# Revenue Features Sprint

## Summary

3 track song song, mỗi track độc lập về file ownership. Đều là tính năng khách hàng thấy trực tiếp.

| # | Track | Effort | Dependencies | Status |
|---|-------|--------|-------------|--------|
| 01 | [Wave 20 Carry-overs](./phase-01-wave20-carry-overs.md) | 14h | none | completed |
| 02 | [Usage Metering API Gateway](./phase-02-usage-metering-api-gateway.md) | 4h | none | completed |
| 03 | [Campaign Analytics v2](./phase-03-campaign-analytics-v2.md) | 6h | none | completed |

## What Changes

| Track | Before | After |
|-------|--------|-------|
| Wave 20 | Telegram text thô, không quota widget, không account export | MarkdownV2 formatting, retry_after honor, sidebar quota widget, account self-service |
| Usage Metering | API gateway không instrumented — blocked requests không track được | Mọi API request qua gateway đều emit usage event |
| Campaign Analytics | Analytics page chưa có (plan cũ ref Supabase) | `/dashboard/analytics` với recharts, D1-backed, real data |

## What Stays the Same

- Payment flow (NOWPayments IPN) — untouched
- Setup Wizard — untouched
- Telegram Bot webhook — enhanced (MarkdownV2), not broken
- 4-layer architecture — all new code in correct layer
- Test count: 6525+ baseline, must not regress

## Key Risks

1. **Telegram MarkdownV2** — escape ký tự đặc biệt (`*_[]()~>#+-=|{}.!`), nếu sót → message gửi lỗi
2. **Usage metering instrumentation** — API gateway là hot path, thêm tracking có thể ảnh hưởng latency
3. **Campaign Analytics** — data source đã migrate từ Supabase sang D1, plan cũ không còn chính xác

## Success Criteria

- `npm run build` → 0 TypeScript errors
- `npm test` → 6525+ pass, 0 fail
- Telegram bot gửi message với MarkdownV2 formatting đúng
- API gateway emit usage event cho mọi request
- `/dashboard/analytics` hiển thị real data từ D1
- 0 protected flow breakage
- 0 `:any` types introduced
