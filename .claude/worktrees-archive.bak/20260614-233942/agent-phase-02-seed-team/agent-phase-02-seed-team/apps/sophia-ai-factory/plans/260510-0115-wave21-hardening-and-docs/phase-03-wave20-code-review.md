---
phase: 03
title: "Wave 20 code-review pass"
priority: P2
status: complete
effort_actual: ~30min
agent: code-reviewer
completed: 2026-05-10
---

# Phase 03 — Wave 20 Code-Review Pass

## Goal

Independent static review của 5 Wave 20 commits đã ship lên main + production để bắt regression risks, security gaps, và tech debt cho Wave 22 backlog.

## Commits Reviewed

| Commit | Phase | Title |
|---|---|---|
| `84906c44` | P01 | Telegram MarkdownV2 escape |
| `d07550aa` | P03 | Sidebar quota widget |
| `661f065b` + `33999bcd` | P05 | Schema rename `video_job_id` → `video_id` |
| `1577e1e7` | P04 | Account self-service (email-change + data-export) |
| `9f051edd` | P02 | Telegram dispatch step split + 429 honor |

## Deliverable

Report tại: `reports/code-reviewer-wave20-2026-05-10.md`

## Findings Summary

| # | Severity | File | Wave 22? |
|---|---|---|---|
| 1 | HIGH/SECURITY | `change-email/route.ts:78` — token plaintext | YES |
| 2 | HIGH/SECURITY | TOCTOU race trên email uniqueness | YES |
| 3 | MEDIUM/RELIABILITY | `publish-execute.ts:374` — retries:0 vs RetryAfterError | YES — verify Inngest behavior |
| 4 | MEDIUM/UX | `change-email/route.ts:96` — silent `#` fallback | YES |
| 5 | LOW/PERF | Migration `0101` — thiếu `(provider, status)` index | YES |

## Verdict per phase

- P01 MarkdownV2 — **SAFE**
- P02 step split — **WATCH** (finding #3 cần verify)
- P03 quota widget — **SAFE**
- P04 email change — **RISK** (findings #1, #2, #4)
- P05 schema rename — **SAFE**

## Action

- KHÔNG fix gì trong Wave 21 (out of scope per plan).
- 5 findings chuyển vào Wave 22 backlog.
- 3 unresolved questions ở report cuối.

## Success Criteria

- [x] All 5 commits reviewed
- [x] Report saved to `reports/`
- [x] Findings prioritized
- [x] Wave 22 backlog identified
