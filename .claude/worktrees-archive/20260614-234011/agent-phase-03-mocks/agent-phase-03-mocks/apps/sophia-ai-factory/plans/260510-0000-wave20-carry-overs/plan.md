---
title: "Wave 20 — Carry-overs from Wave 19 + Wave 18 polish"
description: "Ship deferred items: Telegram UX (MarkdownV2 + retry_after), quota widget, account self-service, schema rename."
status: pending
priority: P1+P2 mix
effort: 2-3d total (4 phases, parallelizable per file ownership)
branch: main
tags: [wave20, telegram, account, quota, schema-cleanup]
created: 2026-05-10
---

# Wave 20 — Carry-overs

## Goal

Close the Wave 19 carry-overs (7A/7B/7C/7F) + minor Wave 18 schema cleanup. None block FREE100 happy path; all polish UX or unblock future work.

## Phase Table

| Phase | Title | Priority | Effort | Source |
|---|---|---|---|---|
| 01 | Telegram MarkdownV2 escaping (7A) | P1 | 2h | Wave 19 carry |
| 02 | Telegram step split + retry_after honor (7F + Phase 05 follow-up) | P1 | 4h | Wave 19 carry |
| 03 | Sidebar quota usage widget (7C) | P2 | 2h | Wave 19 carry |
| 04 | Account self-service: Export + Change-Email (7B) | P1 | 4h | Wave 19 carry — Delete deferred to Wave 21 (legal/audit review) |
| 05 | publishing_jobs.video_job_id → video_id rename | P2 | 2h | Wave 18 carry |

**Total: ~14h. Day 1 ship Phase 01+02 (P1 batch, single deploy). Day 2 Phase 04. Day 3 Phase 03+05.**

## Dependency

```
01 (MarkdownV2) ──► 02 (step split + retry_after)  ← both Telegram, batch deploy
                          │
                          ▼
                    03/04/05 independent
```

## Out of Scope (deferred to Wave 21)

- 7B Account DELETE flow — needs legal review (GDPR), 24h cooldown, admin restore action. Heavy design.
- Phase 05 "true 429 retry" beyond what Phase 02 of Wave 20 ships
- CEO smoke test (separate manual task #234)

## Files

- `phase-01-telegram-markdown-v2.md`
- `phase-02-telegram-step-split-retry-after.md`
- `phase-03-sidebar-quota-widget.md`
- `phase-04-account-export-change-email.md`
- `phase-05-publishing-jobs-rename.md`
