# Observability + DevEx Audit — Sophia AI Factory

**Commit:** `b8c4f6dd` · **Scope:** `apps/sophia-ai-factory/` · **Mode:** read-only

---

## Summary

Observability stack is well-architected for a small team: structured logger with PII scrub, Sentry SDK + HTTP forwarder fallback, cron check-ins, PostHog event taxonomy, real health probes, `/api/version` SHA contract, synthetic monitor cron. Gaps are operational (alerting docs vs reality, sourcemap optionality, missing dashboards) — not foundational.

DevEx is decent for a 200k-LOC repo: 4-layer architecture w/ ESLint enforcement, dev-sops doc, doctor script, fast tests (709ms for 12-test sample). Frictions are env sprawl (60 vars), tier-config build-time/runtime split (NEXT_PUBLIC_*), no local D1 seed convention, and stale claim in `apps/sophia-ai-factory/CLAUDE.md` re: "GitHub Actions disabled" (`test.yml.disabled`, but quality-gate.yml, security-scan.yml, cron-*.yml ARE active).

---

## Findings

### O-01 — Stale doctrine claim: "GitHub Actions disabled" contradicted by active workflows (Observability/DevEx)

- **Severity:** Medium
- **Evidence:** `apps/sophia-ai-factory/CLAUDE.md:120-128` and `.claude/rules/sophia-deploy-verify.md:81` both say "GitHub Actions is disabled by design" / "do NOT poll gh run list". But `.github/workflows/` contains 12 active `.yml` files (quality-gate, security-scan, dependency-audit, cron-fulfillment-{reconcile,retry}, cron-video-status-sync, cron-smoke-one-time, canary-rollback, agent-self-review, sophia-ingestion). Only `test.yml.disabled`, `post-merge-tests.yml.disabled`, `d1-backup.yml.disabled` are actually disabled.
- **Gap:** Subagents reading the doctrine will under-monitor CI. Quality gate (PR-time tsc/eslint/vitest) and security scan workflows exist and should be polled on PRs.
- **Fix:** Edit doctrine to say "deploy workflow disabled; PR gates + crons active". Effort: S (10 min, single doc edit).

### O-02 — Sourcemap upload optional, prod ceiling capped at "minified stack" by design (Observability)

- **Severity:** Medium
- **Evidence:** `apps/sophia-ai-factory/scripts/deploy-with-sha.sh:170` ("Failure here MUST NOT fail the deploy"); `.claude/rules/sophia-no-tech-doctrine.md:55` ("source map upload requires SENTRY_AUTH_TOKEN at deploy time — this is **optional**"); Layer 7 score capped at 8/10.
- **Gap:** Production errors land in Sentry as minified, slowing root-cause analysis. Doctrine accepts this trade-off (operator-side credential), but there is no operator-self-service path (no admin UI to upload sourcemaps post-hoc, no public symbolication via Sentry public release endpoint).
- **Fix:** Either (a) doc the manual `scripts/ci/sentry-upload-sourcemaps.sh` flow in `dev-sops.md` so any teammate can symbolicate ad-hoc, or (b) gate Sentry init on `SENTRY_AUTH_TOKEN` presence at deploy time and log a structured warning when missing. Effort: S.

### O-03 — Health endpoint anonymous fast-path returns 200 even when D1/Redis are degraded (Observability)

- **Severity:** High
- **Evidence:** `src/app/api/health/route.ts:37-47` — unauthorized callers get `{status: 'healthy'}` short-circuit before any probe runs. Uptime monitors / LB probes calling `/api/health` anonymously will report GREEN while D1 is down.
- **Gap:** Uptime telemetry is decoupled from actual service health. A live D1 outage is invisible until an authenticated probe runs (manual only). Real-world impact: incident detection lag.
- **Fix:** Either (a) anonymous fast-path runs a 100ms D1 ping and returns 503 on failure (keeps cold-start small), or (b) introduce `/api/health/liveness` (worker alive) vs `/api/health/readiness` (probes services, no auth, 5s timeout) split — standard k8s pattern. Effort: M.

### O-04 — No alerting rules committed to repo; setup is manual via runbook (Observability)

- **Severity:** Medium
- **Evidence:** `docs/handover/sentry-alerts-setup-runbook-260512.md:6-19` says "5 operational steps" requiring founder to manually create Sentry project, register Slack webhook, push secrets. No `sentry-alerts.json` / IaC for alert rules in repo. No `terraform`/`pulumi` for alert state.
- **Gap:** Alert rules are not version-controlled. If Sentry project is recreated or alerts are deleted, no recovery without re-following 30min runbook. Threshold drift is invisible.
- **Fix:** Export current Sentry alert rules via `sentry-cli alerts export` → commit to `docs/observability/alert-rules.json`. Or use Sentry Terraform provider. Effort: S–M.

### O-05 — `/api/version` and `getBuildMetadata` rely on env vars set only by deploy script — local dev returns "unknown" (Observability/DevEx)

- **Severity:** Low
- **Evidence:** `src/app/api/version/route.ts:38-44` reads `COMMIT_SHA` from `ctx.env` then `process.env`; both empty in `pnpm dev`. `next.config.ts`/wrangler vars are injected by `deploy-with-sha.sh`.
- **Gap:** Dev probe of `/api/version` says `unknown`. Doesn't break anything, but defeats local debugging of SHA-match logic. CI green doesn't prove local renders correctly.
- **Fix:** In `next.config.ts`, fall back to `child_process.execSync('git rev-parse --short HEAD')` when neither runtime env var is set AND NODE_ENV !== 'production'. Effort: S.

### O-06 — PostHog server-side `captureServer` has only 1 call site (Observability)

- **Severity:** Medium
- **Evidence:** `src/app/api/signals/track/route.ts:46` is the only `captureServer({...})` call in source (excluding the wrapper itself). The taxonomy at `src/lib/signals/event-types.ts:91-104` enumerates 11 events including server-only `TIER_UPGRADED`, `PAYMENT_SUCCEEDED`, `CHURN_SIGNAL`. There is also `track()` from `lib/signals/track.ts` used in `webhooks/nowpayments/route.ts`, `cron/workflow-stepper/*`, `cron/local-mode-health/*` etc. — verify this is the canonical path.
- **Gap:** Schema declares server-only PII-sensitive events, but emission is consolidated in `track()` (not `captureServer()`). Confirm signup, payment-succeeded, video-rendered, tier-upgraded all emit. Mixing two abstractions risks coverage holes (e.g., video lifecycle events tracked via Inngest may miss PostHog).
- **Fix:** Add a coverage test that asserts every `EventName` value has at least one production call site (grep + AST). Effort: S.

### O-07 — Cron observability strong (Sentry check-ins) but no dashboard for cron job health overview (Observability)

- **Severity:** Low
- **Evidence:** `src/seed/observability/cron-check-in.ts` wires in_progress→ok|error per cron. `apps/sophia-ai-factory/src/app/api/health/cron-heartbeat/route.ts` exists. `land/observability/cron-run-stats.ts` aggregates locally.
- **Gap:** No single page/dashboard answering "all crons healthy in last 24h?". Stats live in `cron_run_stats` table but UI surface not obvious; ownership unclear.
- **Fix:** Surface `cron-run-stats` aggregate in `/dashboard/admin` (or document existing surface). Effort: S–M if not already wired.

### O-08 — `forwardToSentry` fire-and-forget HTTP path can silently drop on rate limit (Observability)

- **Severity:** Low
- **Evidence:** `src/seed/utils/logger-internals.ts:135-140` calls `forwardToSentry(...)` for message-only error events without awaiting. Sentry 429 responses are ignored.
- **Gap:** Acceptable design (observability must not block availability), but no counter for dropped events. Sustained 429 = silent observability loss.
- **Fix:** Local in-memory ring-buffer counter exported via `/api/health` (`sentry_forward_drops_24h`). Effort: S.

---

### D-01 — Env var sprawl (60 vars in `.env.example`), no grouping enforcement (DevEx)

- **Severity:** Medium
- **Evidence:** `apps/sophia-ai-factory/.env.example` (131 lines, 60 vars). Phase 10 OAuth secrets, Sentry, Better Auth, Inngest, NOWPayments, OpenRouter, Supabase exceptions, R2 hostname all flat. No `.env.example` validator at boot.
- **Gap:** Onboarding teammate must guess which are mandatory for `pnpm dev` vs deploy-only. Setup-Wizard handles customer-facing keys but dev env still requires manual scavenge. Doctor script (`sophia-doctor.mjs`) exists but is post-deploy.
- **Fix:** Add a `pnpm dev:check` precondition: zod-validate `.env.local` against an explicit "dev-required" set (probably 8-10 vars) — fail with actionable message. Effort: S.

### D-02 — Local D1 has no seed convention or repeatable bootstrap (DevEx)

- **Severity:** Medium
- **Evidence:** 60+ migrations under `apps/sophia-ai-factory/migrations/` applied via `scripts/apply-migrations.sh` against `--remote`. No `--local` doc in dev-sops.md; no seed SQL fixture for a working "tier=PREMIUM with API keys" user.
- **Gap:** New contributor cannot reproduce a logged-in dashboard state locally without manual SQL. `e2e-bootstrap-user.ts` exists but is opaque to discovery (not in CONTRIBUTING).
- **Fix:** `pnpm dev:bootstrap` script that runs migrations locally + invokes `e2e-bootstrap-user.ts`. Link from `CONTRIBUTING.md` setup section. Effort: M.

### D-03 — Turbopack-only build silently drops `next-pwa` and `@next/bundle-analyzer` (DevEx)

- **Severity:** Medium
- **Evidence:** `apps/sophia-ai-factory/scripts/deploy-with-sha.sh:24-32` documents that Turbopack is forced due to M1 16GB OOM; "webpack-only plugins (@ducanh2912/next-pwa, @next/bundle-analyzer) are silently skipped". Offline PWA "degraded" per doc.
- **Gap:** Devs who think PWA is working in prod are wrong; bundle analyzer impossible without ssh'ing to a bigger build machine. Hidden behavior == debugging trap.
- **Fix:** Print a deploy-time warning ("⚠ PWA disabled: Turbopack does not support next-pwa"). If PWA is required, plan webpack restoration via beefier CI runner. Effort: S (warning only).

### D-04 — `npm run` vs `pnpm` inconsistency (DevEx)

- **Severity:** Low
- **Evidence:** `.cleo/project-context.json` says "Use pnpm" + "Do not use npm". But `apps/sophia-ai-factory/package.json:34-39` and `deploy-with-sha.sh` use `npm run deploy:full`. `CONTRIBUTING.md:38` says `npm install`. `apps/sophia-ai-factory/CLAUDE.md` deploy section uses `npm`. Root has `pnpm-lock.yaml` AND `package-lock.json` likely.
- **Gap:** Mixed signals. New contributor flips between `npm` and `pnpm`, may produce wrong lockfile updates. Lockfile drift risk.
- **Fix:** Pick one. Cleo config says pnpm; update `package.json` scripts to use `pnpm` consistently OR update `.cleo/project-context.json` to accept `npm`. Effort: S.

### D-05 — Console fallback in `logger-internals.ts` is documented "LEGIT FALLBACK" but linter ignores it; 35 prod console calls remain (DevEx)

- **Severity:** Low
- **Evidence:** Sophia handover rules say "Zero `console.log` in production code" (`apps/sophia-ai-factory/CLAUDE.md:88`). `grep` finds 35 console refs outside tests; most are legit (logger fallback at `logger-internals.ts:129,144,147,150`; SDK module exports 25 docstring examples). Non-doc real calls: `welcome-page-client.tsx:80` (console.error for Telegram), `cron-heartbeat/route.ts:104` (intentional debug).
- **Gap:** Rule technically violated. ESLint isn't enforcing it.
- **Fix:** Allowlist `logger-internals.ts` + `sdk/**` via ESLint disable comments; remove `console.error` in `welcome-page-client.tsx` (use logger). Effort: S.

### D-06 — 455 test files, no flake tracking, coverage thresholds set to 0 globally (DevEx)

- **Severity:** Medium
- **Evidence:** `vitest.config.ts:24-30` sets global lines/functions/branches/statements thresholds to 0. Dashboard-only thresholds are floor=baseline (`lines:4, branches:4, functions:2, statements:3`). Ratcheting deferred to Phase 03 Track B. No flake-detection metadata in repo.
- **Gap:** Coverage gate exists in name only; regressions invisible. Tests can be deleted without alarm.
- **Fix:** Ratchet globals to current observed baseline (run `pnpm test:coverage`, set threshold to observed - 2%). Effort: S–M.

### D-07 — `pnpm dev` does not match prod parity: no wrangler bindings, no D1 (DevEx)

- **Severity:** Medium
- **Evidence:** `package.json:6` `"dev": "next dev"` — pure Next.js. CF Workers bindings (D1, R2, KV, secrets) unavailable. Health probe at `/api/health/route.ts:101-103` catches and skips "CF context unavailable (local dev)".
- **Gap:** Bugs in CF-binding code paths surface only in deployed Worker. `wrangler dev` script exists (`worker:dev`) but not the default.
- **Fix:** Add `pnpm dev:worker` shortcut alongside docs explaining the trade-off; mark `next dev` as "UI-only" mode in CONTRIBUTING. Effort: S.

### D-08 — Stack trace usability in CF Workers is poor without sourcemaps (DevEx)

- **Severity:** Medium
- **Evidence:** Tied to O-02. `wrangler tail` is the canonical real-time error stream per doctrine, but log lines reference minified positions in `.open-next/worker.js`. Recovery requires manual symbolication.
- **Gap:** Debugging prod incidents is slower than necessary.
- **Fix:** As O-02 — document `wrangler tail | symbolicator` pipeline or guarantee sourcemap upload via SENTRY_AUTH_TOKEN. Effort: S.

---

## Scores

### Observability: 78/100

Foundation is good (structured logger w/ PII scrub, Sentry SDK + forwarder fallback, cron check-ins, real health probes, version endpoint, synthetic monitor, PostHog taxonomy). Three gaps prevent higher score: (a) anonymous `/api/health` returns 200 unconditionally, decoupling uptime monitors from real state (O-03); (b) Sentry alert rules are not in repo / IaC (O-04); (c) sourcemap upload is optional and minified traces are the prod default per doctrine (O-02). Lifting these moves the score into the 88–92 band without doctrine changes.

### DevEx: 72/100

Architecture (4-layer, ESLint enforced), dev-sops, doctor script, and fast tests are above average. Frictions are real: 60-var env file with no precondition validator (D-01), no local D1 bootstrap script (D-02), Turbopack silently drops PWA + bundle-analyzer (D-03), mixed pnpm/npm signals (D-04), coverage thresholds at 0 (D-06), `pnpm dev` is not prod-parity (D-07). Onboarding a new teammate takes ~half-day vs achievable ~1 hour. Doctrine claim re: GitHub Actions is partially stale (O-01) and erodes trust in docs.

---

## Open Questions

1. Is `track()` in `lib/signals/track.ts` the canonical server emit path, or is `captureServer()` deprecated? Pick one to unify O-06.
2. Are Sentry alert rules currently configured (the runbook is from 2026-05-12 — has founder followed it)? If yes, export them now per O-04.
3. PWA disablement (D-03): is offline mode a real product requirement, or aspirational? If aspirational, document as wontfix; if required, plan webpack restoration on bigger CI runner.
4. Coverage ratchet (D-06): which phase actually owns this? Plan `plans/260518-1728-sophia-zero-bug-dashboard/` referenced — verify it's tracked.
5. The prior-context `docs/observability-runbook.md` and `docs/postmortems/2026-05-03-github-actions-disabled-deploy-doctrine.md` paths from the audit prompt **do not exist** at those locations. Sentry runbook is at `docs/handover/sentry-alerts-setup-runbook-260512.md`; postmortem appears to live only in `.claude/rules/` and `CLAUDE.md` historical notes. Worth consolidating into `docs/postmortems/` directory.
