---
title: Auto Video Generation + Customer Handoff
status: completed
priority: P1
effort: large
branch: 260430-0054-auto-video-customer-handoff
tags: [video, heyGen, onboarding, email, nowPayments, automation]
created: 2026-04-30
completed: 2026-04-30
---

# Auto Video Generation + Customer Handoff

**Date:** 2026-04-30 | **Mode:** --auto | **Status:** ✅ hoàn thành
**Goal:** Premium+ purchase → auto-gen onboarding video → dashboard + email delivery

## Context

Post-purchase automation: khách mua Premium/ENTERPRISE/MASTER → hệ thống tự gen video onboarding → giao qua dashboard + email notification.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 01 | Pipeline completion (4 stubs → real) | ✅ done |
| 02 | Post-purchase trigger + DB schema | ✅ done |
| 03 | Delivery system (email + dashboard) | ✅ done |
| 04 | Testing + verification | ✅ done |

## Key Decisions

- HeyGen thay HunyuanVideo cho visual step (đã integrate, tạo video hoàn chỉnh luôn)
- Compose step skip (HeyGen output mp4 sẵn) — pass-through
- Remotion IMPOSSIBLE trên CF Workers — bỏ, dùng HeyGen
- Pipeline: script(OpenRouter) → TTS(Coqui) → visual(HeyGen) → compose(skip) → upload(R2) → publish

## Phase Files

- [phase-01-pipeline-completion.md](./phase-01-pipeline-completion.md)
- [phase-02-purchase-trigger.md](./phase-02-purchase-trigger.md)
- [phase-03-delivery-system.md](./phase-03-delivery-system.md)
- [phase-04-testing.md](./phase-04-testing.md)

## Success Criteria

- [x] Build: 0 type errors
- [x] Tests: 100% pass (1798 tests)
- [x] NOWPayments IPN → auto triggers video gen
- [x] Video pipeline end-to-end: request → publish
- [x] Email sent on video published
- [x] Dashboard shows onboarding videos
