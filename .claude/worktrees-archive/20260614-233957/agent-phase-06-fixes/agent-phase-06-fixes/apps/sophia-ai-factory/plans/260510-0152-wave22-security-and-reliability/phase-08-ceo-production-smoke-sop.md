---
phase: 08
title: "CEO production smoke test #234 — manual SOP doc"
priority: P3/LOW/SOP
status: complete
effort_estimate: 0.5h
effort_actual: ~15m
completed: 2026-05-10
dependencies: []
---

# Phase 08 — CEO Production Smoke SOP

## Context Links

- Open task #234: "CEO smoke test Phase 03 (manual, on production)" — pending since Wave 17 P03 distribute-flag flip
- Wave 21 P04: `plans/260510-0115-wave21-hardening-and-docs/phase-04-production-smoke-verification.md` (carryover note: "manual gate handed off")
- Existing handover docs: `apps/sophia-ai-factory/CONTRIBUTING.md`, `apps/sophia-ai-factory/HANDOFF.md`
- Sophia client profile: `~/.claude/rules/sophia-handover-rules.md` (non-tech CEO, bilingual VI+EN, step-by-step with emoji)

## Goal

Document an actionable bilingual smoke-test SOP for the non-technical CEO to verify production after each significant deploy. Pure documentation phase — no code change. Resolves stale task #234 by giving CEO a repeatable script.

## Key Insights

1. **CEO profile** (per `sophia-handover-rules.md`): non-technical, prefers VI+EN, expects step-by-step instructions with emoji.
2. **Smoke surface area** spans 3 protected flows: Setup Wizard, Telegram bot, Payment.
3. **Format** must be copy-paste-runnable: each step = action + expected outcome + screenshot anchor.
4. **Storage location** — `docs/sop-ceo-production-smoke.md` aligns with existing `docs/` convention. Already exists folder per `documentation-management.md`.

## Architecture

Documentation only. No code or infra change.

## Files to Create

| File | Purpose |
|---|---|
| `docs/sop-ceo-production-smoke.md` | Bilingual VI+EN smoke-test SOP |

## Files to Modify

| File | Change |
|---|---|
| `docs/development-roadmap.md` | Add Wave 22 entry referencing this SOP as new operational capability |
| `docs/project-changelog.md` | Add Wave 22 entry noting SOP introduction |

## Implementation Steps

1. **Write `docs/sop-ceo-production-smoke.md`** with this structure:

   ```markdown
   # Sophia AI — Production Smoke Test SOP (CEO)

   > Bilingual EN+VI checklist sau mỗi deploy quan trọng / Run after every important deploy.
   > Thời gian / Estimated time: 5 phút / 5 minutes.

   ## When to run / Khi nào chạy

   - Mỗi lần dev báo "deploy xong" / Whenever dev reports "deploy complete"
   - Trước khi gửi link cho khách / Before sending the URL to a customer
   - Hằng ngày 9 AM (optional) / Daily at 9 AM (optional)

   ## Setup / Chuẩn bị

   1. 🌐 Mở trình duyệt / Open browser → https://sophia.agencyos.network
   2. 🧹 Mở tab ẩn danh (Cmd+Shift+N hoặc Ctrl+Shift+N) / Open incognito tab
   3. 📱 Có sẵn điện thoại để test Telegram bot / Have your phone ready for Telegram bot

   ## Step 1 — Landing page / Trang chủ

   - 🎯 Action: Navigate to https://sophia.agencyos.network
   - ✅ Expect: HTTP 200, page loads <3s, hero section visible
   - ❌ Failure: blank page → take screenshot → message dev: "Landing page broken"

   ## Step 2 — Setup Wizard / Setup Wizard

   - 🎯 Action: Click "Get Started" → fill in test API keys (use OPENROUTER_TEST_KEY from Bitwarden)
   - ✅ Expect: Each step advances; final step shows "Setup complete"
   - ❌ Failure: any step blocks → screenshot → message dev: "Wizard step X broken"

   ## Step 3 — Telegram Bot / Bot Telegram

   - 🎯 Action: Open Telegram → search @Sophia_Bbot → send /campaign
   - ✅ Expect: Bot replies with menu within 5s
   - ❌ Failure: no reply / error message → screenshot → message dev: "Telegram bot down"

   ## Step 4 — Payment Flow / Thanh toán

   - 🎯 Action: Visit /pricing → click "Starter" tier → reach NOWPayments page
   - ✅ Expect: NOWPayments invoice page loads with USDT amount
   - ❌ Failure: 500 error or wrong amount → screenshot → message dev: "Payment broken"

   ## Step 5 — Version check / Kiểm tra phiên bản

   - 🎯 Action: Open https://sophia.agencyos.network/api/version in new tab
   - ✅ Expect: JSON response with `shortSha` matching what dev claimed (e.g., "b7f20a26")
   - ❌ Failure: shortSha doesn't match → message dev: "Stale deploy — re-run deploy:full"

   ## Reporting / Báo cáo

   Nếu tất cả pass / If all pass:
   - Reply trong thread: "✅ Smoke OK at <HH:MM> · SHA <shortSha>"

   Nếu có fail / If any fail:
   - Reply trong thread: "❌ Step X failed · screenshot attached"
   - Tag dev qua Slack/Telegram

   ## Frequency Tier / Tần suất

   - **Critical deploy** (auth, payment, DB migration): chạy ngay / run immediately
   - **Feature deploy** (UI tweak, copy change): chạy trong 1h / run within 1h
   - **Dependency bump** (no functional change): chạy 1 lần/ngày / run once daily
   ```

2. **Update `docs/development-roadmap.md`** — Add Wave 22 row noting "Production Smoke SOP for CEO" as operational deliverable.
3. **Update `docs/project-changelog.md`** — Add 2026-05-NN entry: "[docs] Wave 22 P08: Added CEO production smoke SOP at docs/sop-ceo-production-smoke.md".
4. **Verify links** — confirm SOP file accessible from main `README.md` if applicable; add link reference if missing.
5. **Close task #234** — `cleo task done 234` after SOP committed.

## Migration

None.

## i18n Keys

None (SOP is bilingual inline, like email templates).

## Test Strategy

No automated tests. Manual verification:
- [ ] SOP renders correctly on GitHub web UI (markdown)
- [ ] All step links functional (curl https://sophia.agencyos.network → 200)
- [ ] CEO confirms readability (handoff via Telegram/Slack)

## Success Criteria

- [ ] `docs/sop-ceo-production-smoke.md` created
- [ ] Bilingual VI+EN end-to-end
- [ ] 5 steps cover the 3 protected flows + version check
- [ ] Each step has clear action + expected outcome + failure escalation
- [ ] roadmap.md + changelog.md updated
- [ ] Task #234 marked done in cleo
- [ ] Committed to main with "docs: add CEO production smoke SOP (Wave 22 P08)"

## Risk Assessment

- **R1: SOP drift** — As features evolve, steps may become stale. Mitigation: link this SOP from `apps/sophia-ai-factory/CLAUDE.md` "Quality Gates" section so future devs see it during reviews.
- **R2: API keys in SOP** — Step 2 references "OPENROUTER_TEST_KEY from Bitwarden" — never inline a real key in docs. Verify before commit.

## Security Considerations

- Do not include real API keys, customer emails, or production credentials in the SOP markdown.
- The `/api/version` endpoint is public (per existing config); referencing it in CEO doc is safe.

## Verification Steps

```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
# Confirm file exists, renders
ls -la docs/sop-ceo-production-smoke.md
# Confirm no leaked secrets
grep -iE "secret|password|sk-|api_key=" docs/sop-ceo-production-smoke.md && echo "FAIL: secrets leaked" || echo "OK: clean"
# Standard commit
git add docs/sop-ceo-production-smoke.md docs/development-roadmap.md docs/project-changelog.md
git commit -m "docs: add CEO production smoke SOP (Wave 22 P08)"
# No deploy needed (docs-only change); SHA match check optional
```

## Next Steps

- After SOP commit, ping CEO with link: "@CEO new SOP đây — đọc thử + cho feedback / new SOP here — please read + feedback"
- If CEO requests changes: iterate in same file (single source of truth)
- Future: convert SOP to a Telegram bot command (`/smoketest`) that auto-runs steps 1+5 and reports back
