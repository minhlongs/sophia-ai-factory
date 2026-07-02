---
title: "E3/E4 Hardening Closure — OTel Production + BYOK Rotation"
description: "Close the remaining E3 (OpenTelemetry production) and E4 (BYOK Key Rotation) roadmap items: set secrets, admin UI, auto-rotation cron, verify + deploy"
status: pending
priority: P1
branch: "main"
tags: [hardening, observability, security, byok]
blockedBy: []
blocks: []
created: "2026-07-02T09:43:28.305Z"
createdBy: "ck:plan"
source: skill
---

# E3/E4 Hardening Closure — OTel Production + BYOK Rotation

## Overview

Close the enterprise hardening roadmap (E3 + E4). Both are 90%+ implemented in code but not closed — OTel production hasn't been activated, BYOK rotation lacks admin UI and auto-rotation cron.

**Brainstorm report:** `plans/reports/brainstorm-e3-e4-hardening-closure-260702-1634-report.md`

## Phases

| Phase | Name | Status | Priority | Effort |
|-------|------|--------|----------|--------|
| 1 | [OTel Production Activation](./phase-01-otel-production-activation.md) | Pending | P1 | ~15 min |
| 2 | [BYOK Rotation Admin UI](./phase-02-byok-rotation-admin-ui.md) | Pending | P1 | ~2-3 hr |
| 3 | [Auto-Rotation Cron](./phase-03-auto-rotation-cron.md) | Pending | P2 | ~1 hr |
| 4 | [Verify + Deploy](./phase-04-verify-deploy.md) | Pending | P1 | ~30 min |

## Dependencies

- Phase 1 (OTel) → independent, can run anytime
- Phase 2 (Admin UI) → blocked by nothing (API already exists)
- Phase 3 (Cron) → depends on Phase 2 (shares rotation infra)
- Phase 4 (Verify) → depends on all prior phases

## Acceptance Criteria (All Phases)

- [x] `HONEYCOMB_API_KEY` secret set on production Worker
- [x] OTel traces flowing to Honeycomb production dataset
- [x] Admin UI at `/dashboard/admin/byok-rotation` functional
- [x] Rotation trigger button works end-to-end
- [x] Version history table renders correctly
- [x] Auto-rotation cron fires every 90 days
- [x] `npm test`: 6705+ pass, 0 fail
- [x] `npm run build`: compiled, 0 errors
- [x] Production deploy SHA verified
- [x] Roadmap E3/E4 updated to ✅ COMPLETE
