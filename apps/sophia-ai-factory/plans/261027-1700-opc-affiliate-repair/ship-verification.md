# Ship verification — PR #63 / merge commit `00edba0a`

**Scope:** hoàn tất lần `--ship` đã được founder ủy quyền cho PR #63. Chỉ kiểm chứng
bằng CLI (git/gh), GitHub Actions API, và HTTP GET tối thiểu. **Không** mở browser,
không headless tests, không gọi provider trả phí, không publish nội dung thật, không
tự chạy migration remote thủ công. Tất cả timestamp dưới đây là **UTC** (user tz
Asia/Ho_Chi_Minh = UTC+7).

Verification performed: 2026-10-28 ~00:01–00:22 UTC.

---

## 1. Master prompt & deployment rules (read back)

- `AGENTS.md` § Deployment Rules: canonical pipeline = `.github/workflows/deploy.yml`
  on push/merge to `main`; local deploy deprecated; break-glass only with
  `EMERGENCY_CF_DIRECT=1`; **"Verification Mandate: HTTP 200 is not proof. The live
  edge SHA from https://sophia.agencyos.network/api/version must match the commit SHA
  bit-for-bit."**
- `CLAUDE.md` § Deployment Contract: green report needs deploy.yml exit 0, Stage 1
  gates, live `/api/version` shortSha == commit SHA, smoke `/api/health`(200),
  `/login`(307), `/vi/login`(200).
- `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`: MANDATORY verify
  sequence + required report; "Sai dòng Live SHA Match = chưa verify deploy thực sự."
- `.sophia-factory/CLAUDE.deploy.md` (Phase 4): PR merged, CI green, smoke, journal.

Endpoint contracts (source, not docs):
- `src/app/api/version/route.ts` — public `{shortSha, deployedAt, opennextVersion}`;
  `shortSha = COMMIT_SHA.slice(0,8)`; full `commitSha/branch` only behind
  `INTROSPECT_TOKEN` bearer. `Cache-Control: public, max-age=30, s-maxage=60`.
- `src/app/api/health/route.ts` — public `{status, timestamp, environment}`; full
  `checks/components` only behind `HEALTH_TOKEN`; 200 healthy/degraded, 503 unhealthy.
- `scripts/post-deploy-smoke.mjs` — checks `/api/health`(200), `/api/version`
  (shortSha match), `/login`(200/302/307/308), `/vi/login`(200).

## 2. Merge / PR / main (verified via gh + git)

| Item | Evidence |
|---|---|
| PR #63 state | `MERGED`, `closed:true`, `mergedAt:2026-10-27T23:51:57Z`, `mergedBy: minhlongs`, `mergeCommit.oid: 00edba0a1716b67619e0a2ebcd9f544371690632`, `headRefOid: da4d6b6e…`, 5 commits, 86 files |
| Merge commit object | `parents: [439635e1…(old main), da4d6b6e…(PR head)]`, date `2026-10-27T23:51:56Z` |
| `main` (remote + local) | `00edba0a1716b67619e0a2ebcd9f544371690632` — **unchanged** through 00:22Z; no newer push |
| Pre-merge PR checks (context only) | run `40597331371` Gate1 / `40597331360` Gate2 / `40597331302` Gate4 PASS on `da4d6b6e` — NOT used as post-merge proof |

`main` did not advance: there is exactly ONE post-merge workflow run whose
`headSha == 00edba0a` — the deploy run below. So PR #63's deployment **is** the
current production deployment (no need to disambiguate from a later one).

## 3. Post-merge CI — `Production CI/CD Deploy` run `40605009064` (deploy.yml)

`event: push`, `head_branch: main`, `headSha: 00edba0a`, created
`2026-10-27T23:51:59Z`, **status completed / conclusion success**, updated
`2026-10-28T00:14:55Z`. `gh run watch 40605009064 --exit-status` returned 0.

Workflow triggers audited: `deploy.yml` is the ONLY `push: [main]` deploy workflow.
`quality-gate.yml`, `security-scan.yml`, `dependency-audit.yml` are `pull_request`-
only; the rest are cron/workflow_dispatch (canary-rollback, d1-backup.disabled,
post-merge-tests.disabled, etc.). No other post-merge pipeline for this commit.

All jobs/steps `success`:

```
Stage 1: Quality Gate & Code Health  success  23:52:03 → 00:08:11
  1a TypeScript, 1b ESLint, 1c Layer boundaries, 1d i18n, 1e Vitest  ... all success
Stage 2 & 3: CF Build, D1 Migration & Edge Deploy  success  00:08:15 → 00:14:10
  Preflight credentials, 2a D1 delta migration, 2b next build,
  2c opennext packaging, 3a edge deploy, 3b secret metadata  ... all success
Stage 4: Post-Deploy Verification & Health Smoke  success  00:14:13 → 00:14:54
  4a SHA parity, 4b health endpoints, 4c smoke runner  ... all success
```

Real job-log evidence (read via platform HTTP GET of the GitHub Actions SAS log blob;
CLI curl to that host is blocked by sandbox egress allowlist — see §7):

Stage 2a migration (`job 122548182054`, chunks 4–5):
```
00:09:29 Current live edge SHA: 439635e1
00:09:29 ==> Migrations to apply:
00:09:29 migrations/0482_opc_affiliate_execution_truth.sql
00:10:01    [Preflight] Ghost ledger check OK.
00:10:06 ==> Applying 0482_opc_affiliate_execution_truth to sophia-raas-db
00:10:10 🌀 Executing on remote database sophia-raas-db (78bd1961-…):
         🚣 Executed 13 queries in 13.60ms … "success": true, "changed_db": true
00:10:11    Recording 0482_opc_affiliate_execution_truth into d1_migrations ledger…
00:10:11 All done. Applied: 1 | Skipped: 0
```
Stage 3a edge deploy (`job 122548182054`, chunks 26–28):
```
00:11:28 ✓ Compiled successfully in 75s   (Stage 2b next build)
00:13:46 ✨ Uploaded 66 files (205 already uploaded)
00:13:49 Total Upload: 40073.91 KiB / gzip: 9741.23 KiB
00:13:56 Worker Startup Time: 33 ms
00:13:57 Uploaded sophia-ai-factory (12.34 sec); Deployed … triggers (0.59 sec)
00:13:57 Current Version ID: 6c6ebef4-f5a8-41e2-b117-2ebfca49eac0
00:13:57 ==> Setting Worker secrets: SHA=00edba0a Branch=main At=2026-10-28T00:13:57Z
         ✨ Success! Uploaded secret COMMIT_SHA / DEPLOYED_AT / DEPLOY_BRANCH
```
Stage 4 (`job 122550375710`, chunks 1–2):
```
00:14:29 ==> Verifying Cloudflare edge deployed SHA matches: 00edba0a
00:14:35 ✅ SUCCESS: Live edge shortSha (00edba0a) matches commit SHA (00edba0a) on attempt 1!
00:14:39 ✅ /api/health returned HTTP 200
00:14:40 ✅ /login returned HTTP 307
00:14:47 ✅ /vi/login returned HTTP 200
00:14:53 Smoke Test Results: 4 passed, 0 failed
          ✅ API Health (HTTP 200) ✅ Version endpoint ✅ /login (307) ✅ /vi/login (200)
```

### Non-fatal log observations (honest record, NOT CI failures)
- Build-time SSG emits `level:error` lines `[LandingPagesRepo] D1 binding not
  available` / `No OpenRouter API key available for landing page generation`. These
  are build-time static-generation warnings (no D1 binding during `next build`),
  the build still `✓ Compiled successfully` and the step is `success`. Pre-existing,
  unrelated to PR #63 diff.
- Stage 3b: two `wrangler secret put … --env health` lines log
  `ERROR No environment found in configuration with name "health"`. In deploy.yml
  these two commands carry `|| true` and are best-effort ("Propagate to health
  environment"); wrangler.toml defines envs `["0","1"]` only. The three primary
  secrets (no `--env`) were uploaded successfully. Step conclusion is `success`.
  This is a **pre-existing config drift** in deploy.yml/wrangler.toml, **not** caused
  by PR #63 (PR #63 changed no CI/deploy config: verified `git diff --name-only
  439635e1 00edba0a | grep -i deploy.yml|wrangler|.github/workflows` = empty).
  It did not fail CI, did not affect edge SHA or health. Recorded as a low-severity
  follow-up candidate, NOT a blocker and NOT in this ship's scope.

## 4. D1 migrations (executed by pipeline, not by hand)

- Delta selection was calculated by Stage 2a from the then-live SHA `439635e1`
  (read from `/api/version`) with `bash scripts/apply-migrations.sh "$PREV_SHA"`.
- Local read-only simulation confirmed `git diff --name-only --diff-filter=d
  --relative 439635e1 HEAD -- migrations/` yields exactly
  `migrations/0482_opc_affiliate_execution_truth.sql`.
- That file is present in the merge commit tree (`.gitignore` has an explicit
  `!apps/.../migrations/0482_opc_affiliate_execution_truth.sql` exception committed
  in PR #63). All DDL uses `IF NOT EXISTS` / idempotent patterns; no
  `ALTER TABLE … ADD COLUMN` that would trip the script's column guard.
- Pipeline applied it **remotely** to `sophia-raas-db` (wrangler `--remote`),
  13 queries, `changed_db:true`, recorded into `d1_migrations` ledger,
  `Applied: 1 | Skipped: 0`. Ghost-ledger preflight OK.
- No manual/remote migration was run by the agent. No migration action outside the
  pipeline was needed. Note: because `deployedAt`/`shortSha` are read from the live
  edge, a re-run of this same pipeline with `PREV_SHA=00edba0a` would select no new
  migrations (delta empty) — replay-safe.

## 5. Edge deployment & live SHA

- Stage 3a deployed worker `sophia-ai-factory`, Version ID
  `6c6ebef4-f5a8-41e2-b117-2ebfca49eac0`, at `2026-10-28T00:13:57Z`.
- Stage 3b injected `COMMIT_SHA=00edba0a…`, `DEPLOYED_AT=2026-10-28T00:13:57Z`,
  `DEPLOY_BRANCH=main`.
- Stage 4a (CI vantage) confirmed live `shortSha == 00edba0a`.

## 6. Independent HTTP smoke (agent vantage, no browser)

Sandbox `curl` to `sophia.agencyos.network:443` fails `SSL_ERROR_SYSCALL` because
that host is outside the sandbox egress allowlist (github/codeload/api.github/
npm/pypi/files.pythonhosted only). This is a **sandbox limitation**, not a production
outage. Raw smoke attempt recorded in `ship-evidence/http-smoke-attempt.md`.

The platform's plain HTTP GET channel (returns response text; no JS, no rendering,
no headless browser) reached production. Results:

| Time (UTC) | Endpoint | Result |
|---|---|---|
| 00:04:23 (pre-deploy) | `/api/version` | `{"shortSha":"439635e1","deployedAt":"2026-10-27T04:53:41Z","opennextVersion":"1.19.11"}` — old base; health green but NOT PR #63 (correctly caught by SHA parity) |
| 00:04:23 (pre-deploy) | `/api/health` | `{"status":"healthy","timestamp":"2026-10-28T00:04:23.564Z","environment":"production"}` |
| 00:04 (pre-deploy) | `/login`, `/vi/login` | HTTP 200, EN "Welcome back" / VI "Chào mừng trở lại" |
| 00:05:00 (pre-deploy, cache-buster) | `/api/version?deployVerify=…` | still `439635e1` (rules out CDN cache staleness) |
| 00:16:32 (post-deploy) | `/api/version?shipVerify=…` | `{"shortSha":"00edba0a","deployedAt":"2026-10-28T00:13:57Z","opennextVersion":"1.19.11"}` |
| 00:16:32 (post-deploy) | `/api/health?shipVerify=…` | `{"status":"healthy","timestamp":"2026-10-28T00:16:32.692Z","environment":"production"}` |
| 00:21:26 (final re-probe) | `/api/version?finalVerify=…` | `{"shortSha":"00edba0a","deployedAt":"2026-10-28T00:13:57Z","opennextVersion":"1.19.11"}` |
| 00:21:26 (final re-probe) | `/api/health?finalVerify=…` | `{"status":"healthy","timestamp":"2026-10-28T00:21:26.333Z","environment":"production"}` |

SHA parity per the ACTUAL contract: `shortSha` is the first 8 hex chars of
`COMMIT_SHA` (`version/route.ts`). Expected `00edba0a` (merge commit
`00edba0a1716b67619e0a2ebcd9f544371690632`); live `00edba0a` → **MATCH**.
Full 40-char `commitSha`/`branch` are gated behind `INTROSPECT_TOKEN` (not available
to this agent by design); the 8-char parity is the repo's canonical deploy signal
and is what Stage 4a checks. Two independent network vantage points (CI Stage 4a +
this agent) agree.

## 7. Independent code review

**NOT VERIFIED (no independent reviewer).** Authorized `--ship` does not create a
second reviewer. Verified tooling:
- Runtime provides no subagent / Task / reviewer-agent tool.
- No reviewer CLI on PATH (`claude`, `codex`, `opencode`, `aider`, `gemini`, `amp`
  → all NOT FOUND).
- `.claude/commands/review/*.md` are prompts for a Claude Code CLI that is not
  installed; `.github/agents/agentic-workflows.agent.md` is a workflow-authoring
  dispatcher, not a diff reviewer; `agent-self-review.yml` is a weekly journal
  summarizer calling OpenRouter (a paid provider — forbidden here) and does not
  review PR diffs.
- PR #63 reviews: `reviewDecision: ""`, single `COMMENTED` review by `minhlongs`
  which is explicitly the implementing agent's own read-only second pass
  ("not a second human reviewer"). It stays a SELF-REVIEW; it is NOT upgraded to an
  independent review.
- Required action for a true independent review: a human reviewer or a connected
  reviewer-agent tool with its own context. Not available in this run → keep
  NOT VERIFIED. No `APPROVED` review exists on PR #63.

## 8. Follow-up fix (requirement #4)

**Not triggered.** CI converged green on the first post-merge run; there was no CI
failure caused by PR #63 code/config. The two non-fatal log observations in §3 are
pre-existing config drift outside PR #63's diff. Per instructions, no direct-push to
main, no bypassing checks, no emergency local deploy, no out-of-scope config
rewrite. `main` was not modified during this verification; the session branch
`arena/232f904d-sophia-ai-factory` only receives this evidence doc.

## 9. Remaining blockers / NOT VERIFIED (unchanged by a green deploy)

A green deploy proves the build/migration/edge/HTTP layer. It does **not** upgrade
any of these to PASS:

- **Real-provider render/publish correctness** — NOT VERIFIED. No paid provider
  calls, no real publishing, no media generation against live providers.
- **Telegram bot entrypoint** — NOT VERIFIED (protected flow, not exercised live).
- **Browser / visual / responsive / a11y QA** — NOT VERIFIED and intentionally not
  run (browser is forbidden for this run). No claim of visual QA.
- **Commercial validation** — NOT VERIFIED (no real offers/traffic/revenue; CEX here
  is affiliate marketing, not custody/trading/profit promises).
- **Independent code review** — NOT VERIFIED (see §7).
- **Issue #62 labels** — BLOCKED (admin). GitHub App token gets
  `403 Resource not accessible by integration` when mutating labels; issue #62 is
  still OPEN with `labels: []`. This is an administrative blocker, **not** evidence
  of a production fault.
- **Low-severity config drift (non-blocking)**: deploy.yml `--env health` best-effort
  secret propagation targets a non-existent env; three primary secrets still set.
  Harmless to this ship; candidate for a separate maintenance PR.
- **Build-time SSG `D1 binding not available` / OpenRouter key warnings** —
  pre-existing, non-fatal; landing static pages fall back at build time. Runtime
  DB binding is present (`env.DB sophia-raas-db`) and `/api/health` is healthy.

No claim of "OPC 100%", "production-ready", or "already earning money". Evidence
level: source/math correctness + local integration fixtures (from PR #63) +
post-merge CI + live edge SHA parity + public HTTP health/version smoke.
