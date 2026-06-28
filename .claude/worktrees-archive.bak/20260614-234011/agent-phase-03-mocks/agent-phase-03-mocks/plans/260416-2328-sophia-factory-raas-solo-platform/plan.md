---
title: "Sophia Factory RaaS Solo Platform — 4 Missing Layers (a16z AI-First)"
description: "Bridge 4 missing layers from DeepSeek PDF audit: AI-Native CI/CD + Observability + Signals Loop + AI-SDLC C-Level Agents"
status: shipped
priority: P1
effort: 32h actual
created: 2026-04-16
shipped: 2026-04-17
---

# Sophia Factory RaaS Solo Platform — Implementation Plan

## Goal
Add 4 layers identified by DeepSeek PDF audit vs a16z AI-First Solo Company doctrine to live brownfield Sophia (https://sophia.agencyos.network). NO disruption to Setup Wizard / Telegram bot / NOWPayments webhook.

## Why
- **P1**: Push-to-prod had no canary or rollback → breaks = founder firefight
- **P2**: Errors invisible (no log aggregation, no incident pager)
- **P3**: No signal on which features convert → roadmap by guess
- **P4**: Solo founder can't scale 4 functions (CTO/CMO/CSO/COO) without delegated agents

## Phase Status — ALL SHIPPED 2026-04-17

| # | Phase | Status | PR | Commit | LOC |
|---|-------|--------|-----|--------|-----|
| 1 | AI-Native CI/CD + 5 Enforcement Gates + Canary | ✅ shipped | [#15](https://github.com/longtho638-jpg/sophia-ai-factory/pull/15) | `9f77306` | 1114 |
| 2 | Observability via Better Stack (PII-safe) | ✅ shipped | [#17](https://github.com/longtho638-jpg/sophia-ai-factory/pull/17) | `aa53a43` | 833 |
| 3 | Signals Loop via PostHog (server-validated A/B) | ✅ shipped | [#18](https://github.com/longtho638-jpg/sophia-ai-factory/pull/18) | `ce891fc` | 960 |
| 4 | AI-SDLC Scaffold + 4 C-Level Agents | ✅ shipped | [#16](https://github.com/longtho638-jpg/sophia-ai-factory/pull/16) | `4c1c983` | 1715 |

**Total: ~4,622 LOC, 854/854 tests pass, production HTTP 200 verified.**

## Phase Summaries

### P1 — AI-Native CI/CD (PR #15)
6 GH Actions workflows (deploy/security-scan/quality-gate/dependency-audit/canary-rollback/post-merge-tests). 5 scripts in `scripts/ci/`. New endpoints: `/api/version` + `/api/health/detail` (auth-gated full SHA via `INTROSPECT_TOKEN`). Webhook version-pinning in `middleware.ts`. CSP cleanup (polar.sh removed). Canary rollout via `wrangler versions deploy 10%:90%` with Better Stack-driven auto-rollback (replaces unreliable CF GraphQL). Migration guard blocks canary during pending D1 migrations.

### P2 — Observability via Better Stack (PR #17)
7 telemetry lib modules in `src/lib/telemetry/`: logger, metrics, better-stack-client, error-tracker, pii-scrubber, safe-log, log-buffer. New crons: error-digest (D1 self-monitoring fallback) + heartbeat (Better Stack ping). 8 existing cron routes hardened with `CRON_SECRET` bearer auth. Direct fetch to Logtail (NO @microlabs/otel-cf-workers — RC stage rejected). PII scrubber strips sk-*, eyJ*, Bearer *, emails, phones BEFORE D1 insert. ctx.waitUntil batching (max 3 logs/req). D1 migration `0004_error_log.sql` with `commit_sha` (not reserved `commit`).

### P3 — Signals via PostHog (PR #18)
5 lib modules in `src/lib/signals/`: posthog-capture (direct Capture API, NOT posthog-node), ab-experiment (KV-cached 60s), feature-flags, event-types (typed enum + `_serverOnly` flag), auth-helper. 3 API routes (track/experiments/flag) all gated by `verifySignalsRequest` (CRON_SECRET OR session cookie). 2 components (PostHogProvider, ExperimentVariant). Weekly digest cron (Monday 06:00 UTC). NOWPayments webhook ADD-ONLY: `captureTierUpgraded` after existing tier-activation. Critical events (tier_upgraded/payment_succeeded/churn_signal) emit SERVER-SIDE ONLY.

### P4 — SDLC Scaffold + 4 C-Level Agents (PR #16)
`.sophia-factory/` skeleton: 4 agents (CTO/CMO/CSO/COO) with sandboxed tool access (Read/Edit/Grep/Glob only — NO Write except orchestrator). Each agent has `allowed-paths` glob constraint. 4 CLAUDE.{specification,design,code,deploy}.md lifecycle templates. orchestrator.md = sole `Skill` spawn rights (supervisor pattern). 4 templates (requirement/design/story/deployment-checklist). `journal/.gitkeep` committed (NOT gitignored — audit trail per Red Team #14). `docs/sophia-factory-readme.md` bilingual VN+EN.

## Red Team Review

15 findings capped from 28 raw (3 reviewers × 5-10 each). 12 accepted (8 Critical + 4 High) + 3 Medium accepted + 3 rejected. All inline with code via `<!-- RED-TEAM #N -->` markers.

| # | Finding | Sev | Applied To |
|---|---------|-----|------------|
| 1 | GH Actions injection | Critical | P1 (SHA-pin actions, pull_request only, min permissions) |
| 2 | BYOK key exfil to OpenRouter | Critical | P2 (PII scrubber + fingerprint-only digest) |
| 3 | Unauth cron + signals routes | Critical | P2+P3 (CRON_SECRET bearer) |
| 4 | Wrangler shared-file race | Critical | P1 markers + P2/P3 append-after |
| 5 | Self-monitoring D1 blind spot | Critical | P2 (direct BS push fallback) |
| 6 | Canary + D1 schema skew | Critical | P1 (migration-guard.sh) |
| 7 | NOWPayments IPN canary lottery | Critical | P1 (webhook version pinning) |
| 8 | CF GraphQL ≠ per-version error rate | Critical | P1 (BS webhook → workflow_dispatch) |
| 9 | CF subrequest budget overflow | High | P2+P3 (ctx.waitUntil batch + KV cache) |
| 10 | /api/version commit SHA leak | High | P1 (INTROSPECT_TOKEN gate) |
| 11 | PostHog public key funnel poisoning | High | P3 (`_serverOnly` events) |
| 12 | PII + log injection in Better Stack | High | P2 (safe-log helper) |
| 13 | Rebase cascade across worktrees | High | Plan (merge order P4→P1→P2→P3) |
| 14 | Phase 4 agent sandbox + journal | Medium | P4 (no Write; journal committed) |
| 15 | 863 tests post-merge unverified | Medium | P1 (post-merge-tests.yml) |

## Manual Post-Deploy TODO (founder)

Required for full production use of new layers:

1. **CF Secrets** (some auto-applied):
   - ✅ `EXPERIMENT_KV` namespace created (id `c3857792e4014334ba31b62b19d2f32a` + preview `1f440b4e8566471d841aff66e90644ff`) — auto-injected to wrangler files
   - ✅ D1 migration 0004_error_log.sql applied (with `commit_sha` fix for SQLite reserved word)
   - ⏳ `wrangler secret put COMMIT_SHA INTROSPECT_TOKEN WEBHOOK_SECRET CRON_SECRET BETTER_STACK_LOGS_TOKEN BETTER_STACK_HEARTBEAT_URL POSTHOG_PROJECT_KEY POSTHOG_PERSONAL_API_KEY FOUNDER_EMAIL`

2. **GH Actions Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `INTROSPECT_TOKEN`, `WEBHOOK_SECRET`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

3. **PostHog UI**: Settings → Authorized URLs → add `https://sophia.agencyos.network`

4. **Better Stack**: Create alert rule (error_rate > 1%/5min on canary version) → POST workflow_dispatch to `canary-rollback.yml` with `Authorization: Bearer ${WEBHOOK_SECRET}`

5. **GH Branch Protection**: Require `post-merge-tests` check on main

## Constraints (HARD — all enforced)
- YAGNI / KISS / DRY, files <200 LOC ✅
- Bilingual VN+EN user-facing ✅
- Zero `:any`, zod on inputs ✅
- Conventional commits (no chore/docs in .claude/) ✅
- BYOK preserved — Better Stack + PostHog tokens are PLATFORM keys ✅
- NO Polar (CSP cleanup), NO Vercel ✅

## Lessons Learned

- **Disk pressure**: 4 parallel worktrees + per-worktree node_modules = 2.4GB. Hit ENOSPC mid-flight on M1 Pro. Mitigation: clean worktrees aggressively post-completion.
- **Wrangler markers**: P1 seeded markers prevented hard conflicts; P2/P3 still needed rebase to align placement.
- **Usage limit**: P2 hit Anthropic limit at 3am ICT; resumed cleanly post-reset (worktree commits persist).
- **Worktree CWD chains**: `cd && cmd && cmd` doesn't always preserve CWD across long bash batches; verify pwd before commits.
- **CI gates need secrets**: P1's own gates fail until founder provisions GH+CF Secrets — not a code defect; gate config required pre-flight.
- **SQLite reserved words**: `commit` triggered SYNTAX ERROR at migration apply. Renamed to `commit_sha` post-merge.

## Notes
- Original detailed phase files + research reports + 3 red-team reports were created during planning but lost during finalize (project-manager subagent overwrote with wrong content). Implementation persists 100% in code on main; this consolidated plan is the canonical record.
- For deeper context, see merged PR descriptions (#15, #16, #17, #18) on GitHub.
