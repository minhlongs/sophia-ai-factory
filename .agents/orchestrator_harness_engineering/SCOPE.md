# Scope: Harness Engineering Milestone Decomposition

## Architecture
The Harness Engineering system spans two layers:
1. **Edge (Cloudflare Pages Worker)**: API Gateway endpoints, SQLite D1 queue/results tables, Web Dashboard customize-page settings widget, and Telegram Bot webhook slash commands.
2. **Local (Mac Studio Client)**: Polling daemon, local Remotion video CLI compiler, and external API validation hooks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 0 | Setup Git Branch/Worktree | Initialize git branch/worktree `feature/harness-engineering` and verify configuration | none | DONE |
| 1 | Database Migrations (D1) | Create and apply SQLite D1 migrations for `harness_jobs` and `harness_results` tables | M0 | DONE |
| 2 | Edge API Routes | Implement POST `/api/v1/harness/trigger`, GET `/jobs/poll`, PATCH `/jobs/[id]` routes | M1 | DONE |
| 3 | Local Daemon Script | Implement Node.js daemon script executing 5 local validation checks | M2 | DONE |
| 4 | Multi-channel UI Widgets | React settings dashboard widget & Telegram `/status` and `/audit` Commands | M3 | PLANNED |
| 5 | E2E & Test Verification | Run Vitest suite, tsc type-checks, eslint verification, and Forensic Audit | M4 | PLANNED |

## Interface Contracts
- API Gateway routes are running under Next.js Edge runtime.
- Authentication for polling/updating jobs uses the custom header `X-Harness-Secret`.
