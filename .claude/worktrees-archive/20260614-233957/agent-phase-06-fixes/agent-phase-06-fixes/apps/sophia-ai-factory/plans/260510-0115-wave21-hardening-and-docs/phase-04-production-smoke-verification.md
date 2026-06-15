---
phase: 04
title: "Production smoke + Inngest retry verification"
priority: P3
status: complete (auto smoke ✅, manual gate handed to CEO)
effort_actual: ~20min
completed: 2026-05-10
---

# Phase 04 — Production Smoke + Inngest Retry Verification

## Goal

Verify Wave 20 deploy state (live SHA `9f051edd`) còn healthy + chạy lại các test suites bảo đảm Wave 20 không bị regression. Đề xuất manual smoke procedure cho CEO thử Inngest retry trên production.

## Deliverable

Report: `reports/smoke-260510-0128-wave21-phase04.md`

## What was auto-verified

- ✅ 9 production endpoints (HTTP smoke) — all expected codes
- ✅ `/api/health` returns `status:healthy`
- ✅ `/api/version` confirms live SHA `9f051edd` (Wave 20 P02)
- ✅ 44 Wave 20 unit tests pass on local `cab5925f`
- ✅ HTTP/2 + hreflang + cache-control headers correct

## What requires manual verification (handed to operator)

- ⏳ Inngest 429 retry behavior trong production (cần authenticated + Telegram API)
- ⏳ Real publish job lifecycle observation (Distribute UI → Telegram channel)
- ⏳ CEO smoke test #234 (pre-existing pending task)

## Files

- `reports/smoke-260510-0128-wave21-phase04.md` (smoke report)

## Success Criteria

- [x] All public endpoints respond expected codes
- [x] Live SHA confirmed
- [x] Wave 20 tests still pass
- [x] Manual smoke procedure documented
- [ ] CEO confirms Telegram retry observed in production (deferred to manual gate)
