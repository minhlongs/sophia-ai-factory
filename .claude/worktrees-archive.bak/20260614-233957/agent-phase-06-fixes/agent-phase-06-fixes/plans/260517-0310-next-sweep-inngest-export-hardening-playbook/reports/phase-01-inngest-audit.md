# Phase 01a — Inngest `video_jobs` Chain Audit

**Date:** 2026-05-17 03:25 PDT
**Auditor:** Claude Code (CC CLI auto-mode)
**Verdict:** **Path C — DEPRECATE Inngest chain registration**

## Evidence

### E-1: `video_jobs` table does NOT exist in remote D1

```bash
$ npx wrangler d1 execute sophia-raas-db --remote \
    --command "SELECT status, COUNT(*) AS n FROM video_jobs WHERE created_at > unixepoch() - 86400*30 GROUP BY status;"
ERROR: no such table: video_jobs: SQLITE_ERROR [code: 7500]
```

Cross-checked against `sqlite_master`. Tables present matching `video_*`:
- `videos` ✅ (canonical prod video pipeline)
- `video_onboarding_events` ✅
- `video_usage_monthly` ✅
- `video_jobs` ❌ ABSENT
- `video_cost_log` ❌ ABSENT (from same migration 0031)

### E-2: Migration 0031 NEVER applied

```bash
$ npx wrangler d1 execute sophia-raas-db --remote --command "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 20;"
0030-videos-r2-key.sql     # latest applied
0001-init.sql
0005-mission-steps.sql
0006-schema-alignment.sql
```

Only ~6 migrations tracked via wrangler's `d1_migrations` system. Migration `0031-video-pipeline-jobs.sql` exists locally (`migrations/0031-video-pipeline-jobs.sql`) but never landed on prod.

Root cause: `apply-migrations.sh` uses `git diff HEAD~1 HEAD` — only applies migrations changed in the most recent commit. Migration 0031 was never inside such a diff window post-original-commit.

### E-3: INNGEST keys present, dispatch active

```bash
$ npx wrangler secret list | grep INNGEST
INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY
```

Both keys configured. Inngest event dispatch IS functional. So:
- `url-to-revenue.ts:111` dispatches `url_revenue.video.requested` successfully
- `url-revenue-video-handler.ts` receives event, attempts INSERT INTO `video_jobs` → fails with "no such table"
- Chain breaks immediately at handler entry. Inngest retries 2× then permanent fail.

### E-4: Damage scope — 7 Inngest handlers + 5 land/forest readers

Inngest handlers expecting `video_jobs` (all currently registered in serve handler):
- `videoScripting`, `videoTTS`, `videoVisual`, `videoCompose`, `videoUpload`, `videoPublish`
- `urlRevenueVideoHandler` (writer)

Non-Inngest readers (would fail or graceful-degrade):
- `land/observability/cost-snapshot.ts` (SQL JOIN to video_jobs)
- `land/observability/tenant-summary.ts` (COUNT)
- `land/account/cascade-delete.ts` (DELETE — D1 silently ignores missing table)
- `land/analytics/funnel-stats.ts` (EXISTS check — returns false on missing table)
- `forest/quota/quota-enforcer-video.ts` (COUNT — would error)

Writers (would fail):
- `lib/video/video-job-pipeline.ts` (called by `POST /api/videos/generate`)
- `url-revenue-video-handler.ts` (called by Inngest event)

### E-5: Canonical video path is `videos` table (HeyGen webhook)

The working production video pipeline:
1. User triggers HeyGen API via `video:create` mission or direct purchase
2. HeyGen webhook → `complete-video-from-webhook.ts` → upserts `videos` table
3. `videos` table has its own status FSM: `queued|processing|completed|failed|failed_permanent`

This pipeline is verified live and tested (P27 benchmark + `completed_at` column applied this session).

## Path Decision Matrix

| Path | Description | Rejected reason |
|------|-------------|----------|
| A — keep + harden | Apply migration 0031, env-gate, harden HEAD-check | Resurrects 7 handlers never tested in prod against real D1. High risk for ZERO product value (HeyGen path already covers customer need). |
| B — env-gate + ADR | Defensive env-guard, document as dormant | Doesn't fix Inngest retries on every URL-to-Revenue dispatch. Still noisy logs. |
| **C — deprecate** | Remove from serve registration + ADR | **CHOSEN.** Stops silent failures, preserves test coverage, documents dead-code rationale. |

## Path C Implementation Scope (minimal)

**MUST DO:**
1. Remove 7 functions from `src/app/api/inngest/route.ts` serve registration (videoScripting, videoTTS, videoVisual, videoCompose, videoUpload, videoPublish, urlRevenueVideoHandler).
2. Remove corresponding imports from the same file.
3. JSDoc `@deprecated` tags on all 7 handler files + `url-revenue-video-handler.ts` (preserves test coverage, signals intent).
4. ADR: `docs/architecture-decisions/0007-deprecate-video-jobs-inngest-chain.md`.
5. Remove `inngest.send('url_revenue.video.requested')` call from `src/lib/factory/url-to-revenue.ts:111` (no consumer now). Replace with logger.warn that URL-to-Revenue video generation is disabled.
6. `POST /api/videos/generate` — return HTTP 410 Gone with message pointing to HeyGen path. (Defensive — protects users from 500 errors if endpoint is hit.)

**DO NOT TOUCH (out of scope for Phase 01):**
- Migration 0031 itself — keep file as historical artifact.
- Observability queries — already gracefully error or return null when table missing.
- Cascade-delete — D1 ignores DELETE on missing table.
- `quota-enforcer-video.ts` — only hot path is video upload, not currently in active flow.
- `videos` table + HeyGen pipeline — untouched.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| URL-to-Revenue master-tier customers were depending on chain | LOW | Master-tier video gen was always failing (table absent) — customers either already escalated or never used feature. |
| Tests break after import removal | LOW | Tests unit-test handlers directly; serve handler is integration glue. Verified `route.test.ts` exists. |
| ADR not enough — need migration removal | LOW | Migration file = historical artifact; removal would obscure context. Keep as-is. |
| `POST /api/videos/generate` callers exist | LOW | Endpoint returns 500 today (table missing). 410 Gone is improvement. |

## Verification After Path C

```bash
# 1. Build + test
npm run build  # 0 TS errors expected
npm test       # 4428+ tests pass

# 2. Deploy
npm run deploy:full
# Verify SHA match

# 3. Smoke: confirm Inngest dashboard no longer shows video-* / url-revenue-video-handler invocations
# (Operator action — outside auto-mode)
```

## Unresolved Questions

1. Should `lib/video/video-job-pipeline.ts` be deleted entirely (only called from now-deprecated endpoint), or kept for potential future revival? — Recommend KEEP, mark `@deprecated`.
2. Should `forest/quota/quota-enforcer-video.ts` be updated to use `videos` table or removed? — Defer to follow-up phase, not in scope.
3. Are there any analytics dashboards consuming `video_jobs`-backed observability snapshots? — Recommend operator audit of `/api/admin/observability*` routes before next Phase.
