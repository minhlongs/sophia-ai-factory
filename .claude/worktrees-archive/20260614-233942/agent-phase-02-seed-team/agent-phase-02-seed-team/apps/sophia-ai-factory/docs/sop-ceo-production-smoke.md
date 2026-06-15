# Sophia AI — Production Smoke Test SOP (CEO)

> Bilingual EN+VI checklist sau mỗi deploy quan trọng / Run after every important deploy.
> Thời gian / Estimated time: 5 phút / 5 minutes.

---

## When to run / Khi nào chạy

- 🚀 Mỗi lần dev báo "deploy xong" / Whenever dev reports "deploy complete"
- 📤 Trước khi gửi link cho khách / Before sending the URL to a customer
- 🌅 Hằng ngày 9 AM (optional) / Daily at 9 AM (optional)

## Setup / Chuẩn bị

1. 🌐 Mở trình duyệt / Open browser → https://sophia.agencyos.network
2. 🧹 Mở tab ẩn danh (Cmd+Shift+N hoặc Ctrl+Shift+N) / Open incognito tab
3. 📱 Có sẵn điện thoại để test Telegram bot / Have your phone ready for Telegram bot

---

## Step 1 — Landing page / Trang chủ

- 🎯 **Action**: Truy cập / Navigate to https://sophia.agencyos.network
- ✅ **Expect**: HTTP 200, page loads <3s, hero section visible
- ❌ **Failure**: Trang trắng / blank page → screenshot → message dev: "Landing page broken"

## Step 2 — Setup Wizard / Setup Wizard

- 🎯 **Action**: Click "Get Started" → nhập test API keys (lấy `OPENROUTER_TEST_KEY` từ Bitwarden) / fill in test API keys (use OPENROUTER_TEST_KEY from Bitwarden)
- ✅ **Expect**: Mỗi bước tiến tới được; bước cuối hiện "Setup complete" / Each step advances; final step shows "Setup complete"
- ❌ **Failure**: Bước nào kẹt / any step blocks → screenshot → message dev: "Wizard step X broken"

## Step 3 — Telegram Bot / Bot Telegram

- 🎯 **Action**: Mở Telegram → tìm `@Sophia_Bbot` → gửi `/campaign` / Open Telegram → search `@Sophia_Bbot` → send `/campaign`
- ✅ **Expect**: Bot reply menu trong 5s / Bot replies with menu within 5s
- ❌ **Failure**: Không reply hoặc lỗi / no reply or error → screenshot → message dev: "Telegram bot down"

## Step 4 — Payment Flow / Thanh toán

- 🎯 **Action**: Mở `/pricing` → click tier "Starter" → chờ chuyển sang trang NOWPayments / Visit `/pricing` → click "Starter" tier → reach NOWPayments page
- ✅ **Expect**: Trang NOWPayments hiện hoá đơn USDT / NOWPayments invoice page loads with USDT amount
- ❌ **Failure**: 500 error hoặc số tiền sai / 500 error or wrong amount → screenshot → message dev: "Payment broken"

## Step 5 — Version check / Kiểm tra phiên bản

- 🎯 **Action**: Mở https://sophia.agencyos.network/api/version trong tab mới / Open in new tab
- ✅ **Expect**: JSON response với `shortSha` khớp dev đã báo (vd: `"b7f20a26"`) / JSON response with `shortSha` matching what dev claimed
- ❌ **Failure**: `shortSha` không khớp / doesn't match → message dev: "Stale deploy — re-run deploy:full"

---

## Reporting / Báo cáo

**Tất cả pass / If all pass:**
- Reply trong thread: `✅ Smoke OK at <HH:MM> · SHA <shortSha>`

**Có fail / If any fail:**
- Reply trong thread: `❌ Step X failed · screenshot attached`
- Tag dev qua Slack/Telegram

## Frequency Tier / Tần suất

| Loại deploy / Deploy type | Hành động / Action |
|---|---|
| **Critical** (auth, payment, DB migration) | Chạy ngay / Run immediately |
| **Feature** (UI tweak, copy change) | Chạy trong 1h / Run within 1h |
| **Dependency bump** (no functional change) | 1 lần/ngày / Once daily |

---

## Notes / Ghi chú

- API keys phải lấy từ Bitwarden, KHÔNG inline trong tài liệu này / API keys must come from Bitwarden, NEVER inline in this doc
- `/api/version` endpoint là public (an toàn để CEO truy cập) / `/api/version` is public (safe for CEO access)
- Nếu CEO có feedback, edit trực tiếp file này (single source of truth) / If CEO has feedback, edit this file directly (single source of truth)

## Related / Liên quan

- Deploy doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Handover client profile: `~/.claude/rules/sophia-handover-rules.md`
- Production URL: https://sophia.agencyos.network
- Repo: https://github.com/longtho638-jpg/sophia-ai-factory

---

_Last updated: 2026-05-10 (Wave 22 P08)_
