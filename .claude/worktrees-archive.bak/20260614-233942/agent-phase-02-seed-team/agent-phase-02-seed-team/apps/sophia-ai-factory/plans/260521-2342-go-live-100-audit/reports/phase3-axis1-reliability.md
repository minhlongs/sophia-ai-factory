# Phase 3 — Axis 1: Reliability Audit

**Date:** 2026-05-22
**Auditor:** axis-1 reliability subagent
**HEAD (local & prod):** `d86659bf`
**Doctrine:** SUSPENDED — score honestly, no no-tech waivers.

---

## Score Summary — 36 / 60

| # | Sub-area | Score | Verdict |
|---|---|---:|---|
| 1 | Backup / Restore (D1 + R2 lifecycle) | 4/10 | Route exists, never executed in prod; staging drill only |
| 2 | Migration tracking & rollback | 3/10 | Severe drift: 4/117 tracked, no replay safety, no down migrations |
| 3 | Cron resilience | 6/10 | scheduled() injector works, Sentry check-ins, but no retries + 6 unscheduled patterns |
| 4 | Error budgeting / SLO | 3/10 | SLO numbers mentioned in load-test doc; not defined, not measured, not alerted |
| 5 | Idempotency & retry semantics | 7/10 | NOWPayments IPN guarded; Inngest mixed (publish-execute `retries:0` known broken) |
| 6 | Graceful degradation | 7/10 | ElevenLabs + variant-generator fallback; HeyGen + D-ID throw hard; circuit breaker only for usage-metering |

**Total: 36/60** — honest reliability ceiling. Big gaps are operational track record, not code.

---

## 1. Backup / Restore — 4 / 10

### Evidence

- Cron route: `src/app/api/cron/d1-backup/route.ts:60-158` — full happy path (dump → R2.put → cron_run_log → Sentry check-in). 12h idempotency window (line 35). 50 MiB hard ceiling (line 42).
- R2 bucket binding: `wrangler.toml:26-28` (`sophia-backups`) — 30-day lifecycle assumed.
- Dump builder: `src/forest/dr/d1-dump-builder.ts:22` — skips `d1_migrations` table.
- DR runbook: `docs/disaster-recovery.md:1-40` — RTO 4h / RPO 24h documented.
- Staging DR drill: `docs/dr-drill-260518.md` — **wall-clock RTO 12.98s, RPO 0s on staging**, parity verified (table count 120/120). Procedure note documents `d1_migrations` strip workaround.

### Findings

- **P0 — Backup never executed in prod.** Prompt states `cron_run_log` count for `d1-backup` = 0. Route is reachable but the cron pattern that would invoke it (`0 7 * * *` via injected scheduled handler) is in `wrangler.toml:64` cron list — yet the inject route map at `scripts/inject-scheduled-handler.mjs:34-90` does **NOT** include `0 7 * * *` → llm-cache-purge and `d1-backup` route is unmapped. The cron fires but no route dispatches.
- **No R2 lifecycle proof.** `wrangler.toml` comments claim "30-day R2 lifecycle handles retention" (`wrangler.toml:25`) but no `[[r2_buckets.lifecycle]]` block exists in the toml. `scripts/infra/audit-r2-lifecycle.sh` exists (not read here) — has it been run on `sophia-backups`?
- **DR drill never executed on prod D1.** Only staging proof. Production restore is theoretical.
- **No off-site copy.** R2 alone — same provider as origin D1. Cloudflare-wide outage = zero RPO honored.

### P0/P1 actions

- P0: Add `0 7 * * *` (or chosen pattern) to `inject-scheduled-handler.mjs` `CRON_ROUTES` map mapping to `/api/cron/d1-backup`. Redeploy. Verify `cron_run_log` row appears next day.
- P1: Provision R2 lifecycle policy explicitly (Cloudflare API or dashboard) and capture proof in `docs/disaster-recovery.md`.
- P1: Run quarterly prod restore drill (current cadence: never).

---

## 2. Migration tracking & rollback — 3 / 10

### Evidence

- 120 SQL files in `migrations/` (`ls migrations/ | wc -l` = 120; numbered 0001 → 0119 + 1 dup).
- Apply script: `scripts/apply-migrations.sh:30-37` — shells `npx wrangler d1 execute sophia-raas-db --file="$m" --remote`. Uses raw `d1 execute`, **not** `d1 migrations apply`.
- Tracking table mismatch: `d1_migrations` is wrangler-managed; the project does not own its DDL (`grep -rn d1_migrations migrations/` = 0 matches in SQL).
- Per prompt: prod `d1_migrations` has 4 rows for 117 applied migrations → 113-row drift.

### Findings

- **P0 — Migration applier bypasses tracking.** `d1 execute --file` does not write `d1_migrations`. The 113-row drift means re-running `wrangler d1 migrations apply` on prod would attempt to re-execute 113 already-applied migrations, most of which will fail (duplicate CREATE TABLE) or silently mutate (INSERT-only files).
- **P0 — No down migrations.** `ls migrations/` shows only forward `.sql`. Zero rollback path. Bad migration → manual hand-DDL or backup restore (which the backup cron isn't running, see Sub-area 1).
- **P1 — Naming drift.** `0004-better-auth.sql` and `0004_error_log.sql` share prefix → ordering ambiguous (hyphen vs underscore separators throughout, e.g. `0015_tier_change_events.sql` vs `0014-export-jobs.sql`).
- `scripts/check-migration-coverage.sh` exists — not validated here whether it enforces anything in pre-push.

### P0/P1 actions

- P0: Reconcile `d1_migrations` table once — backfill 113 rows for already-applied migrations (`INSERT OR IGNORE` keyed by filename), then switch apply script to `wrangler d1 migrations apply`.
- P0: Add explicit `migrations/down/NNNN-*.sql` for any P0-risk forward migration; require pre-push gate to enforce pairing for new migrations.
- P1: Enforce single naming convention (hyphen or underscore, not both) via `check-migration-coverage.sh`.

---

## 3. Cron resilience — 6 / 10

### Evidence

- 18 cron patterns in `wrangler.toml:64`.
- Injector mapping: `scripts/inject-scheduled-handler.mjs:33-91` — covers 13 patterns explicitly, plus warnings for missing routes (`scripts/inject-scheduled-handler.mjs:100-105`).
- Patterns in toml but NOT in CRON_ROUTES injector map: `0 5 * * *`, `*/10 * * * *`, `0 7 * * *`, `10 * * * *`, `0 */4 * * *` — **5 unscheduled patterns burn invocations with no handler** (confirmed by injector route-map at script lines 34-90).
- Dispatch path: `scripts/inject-scheduled-handler.mjs:142-158` — `ctx.waitUntil(Promise.allSettled(dispatches))`. Fire-and-forget; **no retry on dispatch failure**.
- Cron auth: `src/seed/security/cron-auth.ts` enforces Bearer; routes call `verifyCronAuth(request)` (e.g. `src/app/api/cron/d1-backup/route.ts:61`).
- Observability: `src/seed/observability/cron-check-in.ts:25-40` Sentry monitor wrapping; `src/lib/cron/run-tracker.ts:36-42` writes `cron_run_log` with UPSERT.
- Alert path: `src/app/api/cron/uptime-check/route.ts:108-137` — Telegram alert via `alertAdmin()` for health degradation only. **No "cron missed" alerter** exists; would require a meta-cron querying `cron_run_log.last_run_at`.

### Findings

- **P0 — 5 cron patterns unmapped** = wasted CF Worker invocations + missed work (`d1-backup`, weekly-signals partial coverage uncertain).
- **P1 — No dead-letter.** Cron handler 500 → row in `cron_run_log` with `last_status='failure'` and Sentry alert, but no requeue. Next scheduled tick is the only retry.
- **P1 — No "missed run" detector.** If a route 500s for 7 days, `last_run_at` stays old; no automated alert fires. `cron_run_log` is informational, not actively monitored.

### P0/P1 actions

- P0: Reconcile `wrangler.toml` crons list against `CRON_ROUTES` map — either map or remove every pattern. Add CI gate (script that diffs the two).
- P1: Add meta-cron `cron-health-monitor` (every 6h) that queries `SELECT cron_name FROM cron_run_log WHERE last_run_at < now() - expected_interval`, alerts via Telegram.

---

## 4. Error budgeting / SLO — 3 / 10

### Evidence

- `docs/load-test-260518.md:17-20` mentions "SLO budget of 500ms" and "/api/health SLO 100ms" — informal numbers, not codified.
- `docs/INCIDENT_RESPONSE.md:433` lists "Metrics dashboard — error rate, webhook latency, tier activation time (SLOs)" as **TODO checkbox**, not done.
- `src/app/api/cron/uptime-check/route.ts:128` hard-coded `LATENCY_WARN_MS` threshold for Telegram alert (only latency, not error budget burn).
- Sentry config: `src/lib/observability/sentry-options.ts:179` adds `cron_route` tag for alerting — usable for SLO rules but no rules in repo.
- No `slo.yaml`, no `error_budget.ts`, no Grafana/Datadog config.

### Findings

- **P0 — No SLO defined for any user-visible path.** Per-route p95, error rate, monthly availability target → all absent.
- **P0 — No error budget tracking.** No code measures monthly burn vs. target.
- **P1 — Alerting is binary (up/down) not budget-aware.** Telegram alert fires on every >threshold latency tick — alert fatigue inevitable.

### P0/P1 actions

- P0: Document SLOs in `docs/slo.md` (target availability 99.5%, p95 < 800ms, webhook delivery < 5 min). Bind to Sentry alert rules.
- P1: Add monthly SLO report cron (Sentry Insights or query Sentry API to D1, store in `slo_burn` table).

---

## 5. Idempotency & retry semantics — 7 / 10

### Evidence

- **NOWPayments IPN** (`src/app/api/webhooks/nowpayments/route.ts`):
  - Signature verify HMAC-SHA512 (line 43).
  - Zod payload validate (line 53).
  - Handler dispatch → `processNowPaymentsIpn` (`src/land/billing/nowpayments-ipn-handlers.ts:30-55`).
  - **Idempotency check:** `if (await isPaymentProcessed(payment_id)) return { success: true, message: 'Already processed' }` (line 35). Strong guarantee against double-charge.
  - Two-phase `recordIpnEvent` (line 37 pre, line 48 post) — partial-failure observable.
- **Inngest retries — mixed:**
  - Good: `video-scripting.ts:54` (3), `video-compose.ts:24` (3), `video-upload.ts:25` (3), `video-publish.ts:38` (3), `url-revenue-video-handler.ts:19` (2), `account-delete-finalize-cron.ts:36` (1).
  - **Bad: `publish-execute.ts:197` has `retries: 0`** — function-level disables retries including RetryAfterError. Known issue documented in code comment at line 180-186: "429 from Telegram → permanent fail → user re-triggers manually via UI." Marked for Wave 23 fix; not done at `d86659b`.
- **Cron idempotency:** `src/lib/cron/run-tracker.ts:21-42` `recordCronRun` is UPSERT-by-name (one row per cron). `wasRecentlyRun` window guard (`src/app/api/cron/d1-backup/route.ts:35,94`) prevents same-window double-dump.

### Findings

- **P0 — `publish-execute` retries:0 is data loss.** Per code comment, Telegram 429 → silent permanent fail. Wave 23 fix is overdue.
- **P1 — `publishing_results` insert non-idempotent** (`publish-execute.ts:184`): `randomUUID()` per attempt means re-running creates duplicates. Even if retries flipped to 2, would double-publish.
- **P1 — Inngest `step.run` idempotency varies by step.** Not all `step.run` blocks are checked for at-least-once safety (would need per-function audit).

### P0/P1 actions

- P0: Flip `publish-execute` to `retries: 2`. Make `publishing_results` insert idempotent via `(job_id, attempt)` unique key + ON CONFLICT.
- P1: Audit each Inngest function's `step.run` for retry-safe writes.

---

## 6. Graceful degradation — 7 / 10

### Evidence

- **Variant generator fallback:** `src/forest/ab/variant-generator.ts:25-82` — missing OpenRouter BYOK → deterministic fallback variants (line 74); LLM call failure → fallback (line 82). Logged but doesn't break flow.
- **ElevenLabs fallback:** `src/lib/ai/elevenlabs-api-client.ts:88-102` — mock voiceover URLs returned when key absent OR call fails (matches doc comment line 88).
- **Usage-metering circuit breaker:** `src/forest/usage-metering/realtime-tracker-circuit-breaker.ts:17` — per-key Map of `{state, failures, lastFailureTime}`. Used by `realtime-tracker.ts:21` to gate writes. State persists in-process only (Worker isolate-local; lost on cold start).
- **HeyGen client:** `src/lib/heygen/heygen-client.ts:68` — throws `HeyGen API error: ...` on non-OK. No fallback. Caller must handle.
- **D-ID:** no fallback path located; same pattern as HeyGen.
- **Incident state machine:** `src/land/status/incident-state-machine.ts:7` and `status-store.ts:6` define `ok | degraded | down` states — exposed via `/api/cron/uptime-check`. Surfaces degradation to admins, doesn't auto-route around it.
- **Bundle outage apology email:** `src/land/billing/email/templates/bundle-outage-apology.ts:2` — circuit-breaker-opened customer email template exists.

### Findings

- **P1 — Circuit breaker state is per-isolate.** `circuitBreakers = new Map()` in module scope means each CF Worker isolate has its own counter. Across hot/cold mix, breaker effectively never trips on low-traffic keys. Needs D1/KV-backed state for cross-isolate.
- **P1 — HeyGen / D-ID outage = hard fail.** Video pipeline is the customer's core revenue product; no degraded mode (e.g., queue retry, downgrade to cheaper provider, partial completion).
- **P2 — OpenRouter fallback only at variant-generator.** Other LLM call sites (ai-write, lead-export enrichment) use BYOK with stub fallback comments in `command-registry.ts:61-71` — confirm coverage breadth.

### P0/P1 actions

- P1: Move circuit-breaker state to D1 (or KV) so all isolates share breaker decisions.
- P1: Wrap HeyGen + D-ID calls in queue with exponential backoff + customer-visible "video delayed" status; design fallback provider chain.

---

## Top 3 P0 / P1 Reliability Findings (overall)

1. **P0 — D1 daily backup cron never executes in prod.** Route is built (`/api/cron/d1-backup`) and Cloudflare cron triggers fire (`wrangler.toml:64`), but the injected `scheduled()` route map (`scripts/inject-scheduled-handler.mjs:34-90`) **omits** `0 7 * * *` and the d1-backup route entirely. `cron_run_log` count = 0 confirms. Net: **zero production backups exist**. Fix: add the mapping, redeploy, verify next-day row in `cron_run_log`.

2. **P0 — Migration tracking drift = unrecoverable upgrade path.** `apply-migrations.sh` uses raw `wrangler d1 execute --file`, bypassing the wrangler-managed `d1_migrations` table. Prod has 4 tracked vs 117 actually applied (113-row drift). Any future `wrangler d1 migrations apply` will attempt to replay 113 migrations and fail or corrupt. Combined with zero down-migrations, this is one bad PR away from a restore-from-backup event (which is also broken — see #1).

3. **P0 — `publish-execute` Inngest function has `retries: 0` + non-idempotent insert.** `src/forest/inngest/functions/publish-execute.ts:197` plus comment at lines 180-186 acknowledge: Telegram 429 = silent permanent publish failure for the customer. Compounded by `randomUUID()` insert at line 184 — even if retries enabled, would duplicate-publish. This is the most user-visible reliability defect in the entire codebase right now.

---

## Unresolved Questions

1. R2 `sophia-backups` lifecycle policy: does it actually exist on the bucket? `scripts/infra/audit-r2-lifecycle.sh` exists — when last run, against which bucket?
2. `0 7 * * *` cron pattern present in `wrangler.toml:64` but absent in `CRON_ROUTES` map — is `llm-cache-purge` also unmapped or is it routed elsewhere via different pattern?
3. Sentry SDK: `BETTER_STACK_LOGS_TOKEN` referenced in `d1-backup/route.ts:48` — is Better Stack actually receiving any logs in prod, or is the token unset (silent no-op via `pushFatalLog(...).catch(() => {})`)?
4. Does the pre-push 6-gate pipeline include a `wrangler.toml` crons ↔ `inject-scheduled-handler.mjs` consistency check? If not, finding #1 will recur.
5. `circuit_breaker_failure` events in `realtime-tracker-circuit-breaker.ts:71` — are they aggregated anywhere, or per-isolate noise?
