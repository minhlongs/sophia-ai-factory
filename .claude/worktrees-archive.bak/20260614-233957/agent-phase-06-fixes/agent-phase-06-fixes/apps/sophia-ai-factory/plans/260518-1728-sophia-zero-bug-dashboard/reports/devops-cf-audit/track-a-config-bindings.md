# Track A: CF DevOps Audit — Config, Bindings, Secrets, Crons, Deploy Scripts
Date: 2026-05-18 | Auditor: debugger agent | Read-only

---

## §1 wrangler.toml Binding Summary

| Binding | Type | Name/ID | Role |
|---|---|---|---|
| `ASSETS` | Assets | `.open-next/assets` | Static file serving |
| `NEXT_INC_CACHE_R2_BUCKET` | R2 | `sophia-ai-factory-opennext-cache` | OpenNext ISR/RSC cache |
| `VIDEO_BUCKET` | R2 | `sophia-videos` | HeyGen video storage |
| `BACKUPS_BUCKET` | R2 | `sophia-backups` | D1 daily dump target (30d lifecycle) |
| `DB` | D1 | `sophia-raas-db` / `78bd1961` | Primary database |
| `NEXT_TAG_CACHE_D1` | D1 | `sophia-tag-cache` / `7b1d4fd4` | OpenNext revalidateTag cache |
| `WORKER_SELF_REFERENCE` | Service | `sophia-ai-factory` | Internal cron dispatch via self-fetch |
| `IMAGES` | Images | (CF Images binding) | Image transform |
| `EXPERIMENT_KV` | KV | `c38577...` / preview `1f440b...` | A/B flag cache (60s TTL) |

**Config notes:**
- `compatibility_date = 2026-03-17`, flags: `nodejs_compat` + `global_fetch_strictly_public` — current, correct.
- No `smart_placement` or `observability` blocks — analytics not configured at CF level.
- No `routes` / custom domain block in wrangler.toml; domain mapping must be via CF dashboard.
- `[vars]` block has only `NEXT_PUBLIC_DISTRIBUTE_ENABLED="1"` and `IS_CONFIGURED="true"` — both baked at build by deploy-with-sha.sh export; the wrangler vars block is documentation-only.
- `COMMIT_SHA`/`DEPLOYED_AT`/`DEPLOY_BRANCH` are injected as **secrets** (not vars) — correct, since they must not be baked.
- Build command NOT in wrangler.toml; driven entirely by npm scripts. OpenNext build via `@opennextjs/cloudflare build`.

---

## §2 Secrets Audit

### Confirmed present on prod (46 total)
`ADMIN_PASS`, `ADMIN_USER`, `ANTHROPIC_API_KEY`, `API_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `BYOK_MASTER_KEY`, `COMMIT_SHA`, `CREDENTIALS_MASTER_KEY`, `CRON_SECRET`, `DEPLOY_BRANCH`, `DEPLOYED_AT`, `EMAIL_FROM`, `HEALTH_CHECK_SECRET`, `HEYGEN_*` (8), `HUBSPOT_*` (3), `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INTERNAL_API_SECRET`, `JWT_SECRET=REDACTED`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NOWPAYMENTS_*` (3), `POLAR_*` (7), `RESEND_API_KEY`, `SENTRY_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_SIGNING_SECRET`

### Missing from prod but referenced in code
| Secret | Code Location | Severity |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | cron/weekly-signals-digest, bot handlers | **HIGH** — Telegram bot silent if unset |
| `TELEGRAM_ADMIN_CHAT_ID` | alert/uptime handlers | HIGH |
| `TELEGRAM_FOUNDER_CHAT_ID` | weekly-digest-delivery.ts | MEDIUM |
| `BETTER_STACK_LOGS_TOKEN` | d1-backup/route.ts | MEDIUM — logging silent |
| `BETTER_STACK_INGESTING_HOST` | d1-backup/route.ts | MEDIUM |
| `BETTER_STACK_HEARTBEAT_URL` | heartbeat cron | LOW — optional ping |
| `POSTHOG_PERSONAL_API_KEY` | weekly-digest-ai.ts | LOW — analytics only |
| `POSTHOG_PROJECT_KEY` | analytics | LOW |
| `FOUNDER_EMAIL` | weekly-digest-delivery.ts | LOW — falls back to Telegram |
| `RESEND_FROM_EMAIL` | email delivery | MEDIUM — emails may 5xx |
| `BACKUP_HEARTBEAT_URL` | d1-backup/route.ts | LOW — optional heartbeat |

### Smell: NEXT_PUBLIC_* stored as secrets
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` are set as secrets but are baked into the client bundle at build time from env vars. Storing as CF secrets is redundant (they're public by definition) and adds noise to the secrets list. Should be `.dev.vars` / build-time env only.

### Smell: POLAR_* secrets present
7 Polar secrets on prod (`POLAR_API_KEY`, `POLAR_API_URL`, `POLAR_PRODUCT_*`, `POLAR_WEBHOOK_SECRET`). Per CLAUDE.md + doctrine: "Polar.sh REJECTED this product — DO NOT use Polar for Sophia." Dead secrets should be purged.

### Smell: INNGEST_* secrets present
`INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` present. Inngest is used in 61 source files. However, Inngest requires a Node.js runtime (or dedicated edge runtime), not CF Workers. Likely dead or dev-only. Needs verification.

---

## §3 Cron Audit

### wrangler.toml schedules (17 total)
| Schedule | Mapped in inject-scheduled-handler.mjs? | Handler route(s) | File exists? |
|---|---|---|---|
| `*/5 * * * *` | YES | uptime-check, video-status-sync, sop-scheduler | OK |
| `5 * * * *` | YES | usage-export | OK |
| `0 1 * * *` | YES | dunning-advance | OK |
| `0 2 * * *` | YES | subscription-reminders | OK |
| `0 3 * * *` | YES | scheduled-campaigns | OK |
| `0 4 * * *` | YES | email-drip | OK |
| `0 6 * * 1` | YES | weekly-signals-digest | OK |
| `0 0 1 * *` | YES | mcu-monthly-reset | OK |
| `0 0 * * *` | YES | clearance-promote, promo-trial-expiry | OK |
| `7 * * * *` | YES | handover-status-sync | OK |
| **`0 5 * * *`** | **NO** | error-digest (commented P2) | OK |
| **`*/10 * * * *`** | **NO** | heartbeat (commented P2) | OK |
| **`*/1 * * * *`** | **NO** | workflow-stepper | OK |
| **`0 7 * * *`** | **NO** | llm-cache-purge | OK |
| **`10 * * * *`** | **NO** | wallet-rebuild | OK |
| **`0 */4 * * *`** | **NO** | affiliate-scout | OK |
| **`*/15 * * * *`** | YES (smoke-one-time) | smoke-one-time | OK |

### Handlers in CRON_ROUTES but NOT in wrangler.toml (never fires)
| Pattern | Handler | Risk |
|---|---|---|
| `*/2 * * * *` | fulfillment-retry | **HIGH** — fulfillment retries never fire; stale orders pile up |
| `0 6 * * *` | fulfillment-reconcile | HIGH — drift detection never runs; note says "via GitHub Actions" but Actions disabled |

### Cost/frequency concern
`*/1 * * * *` (every minute) → workflow-stepper fired every minute but **NOT mapped** in CRON_ROUTES → no dispatch. CF still bills the cron invocation. The scheduled() handler returns early with "No handler for cron pattern" log. Low cost but noisy.

---

## §4 Deploy Script Findings

### Gold path: `npm run deploy:full` → `deploy-with-sha.sh`
Steps: push-precondition → supabase-manifest-gen → next build (NEXT_PUBLIC_DISTRIBUTE_ENABLED baked) → fix-instrumentation → opennext build → inject-scheduled-handler → secret put ×3 (retry 3× exponential) → wrangler deploy (retry 3×) → sentry sourcemap (non-fatal) → optional post-deploy E2E smoke.

Well-structured. Retry logic added 2026-05-17 after 502 incident. Push guard added 2026-05-15.

### Script comparison
| Script | Push guard | SHA inject | Retry | Post-verify |
|---|---|---|---|---|
| `deploy-with-sha.sh` | YES (exit 2) | YES (secret put) | YES (3×) | Optional (RUN_POSTDEPLOY_E2E) |
| `deploy-staging.sh` | Optional (STAGING_REQUIRE_PUSH) | YES | YES (3×) | None |
| `deploy-full-verified.sh` | Via deploy-with-sha.sh | YES | YES | YES + E2E go-live |
| `npm run deploy` (raw) | **NO** | **NO** | **NO** | **NO** |

**Risk:** `npm run deploy` exists as npm script and calls bare `wrangler deploy` — bypasses all guards. An agent or operator running `npm run deploy` instead of `deploy:full` produces a stale SHA and skips push precondition.

### E2E gate integration
`deploy-full-verified.sh` requires `E2E_TEST_USER_PASSWORD` env var — will abort if not set. Good for CI-like use. However it's not `deploy:full` (which is the canonical command per CLAUDE.md). The `deploy:all` script chains `deploy:full + deploy:migrations + deploy:verify`, but NOT `deploy-full-verified.sh`. The E2E gate is optional/manual only.

### Idempotency
`inject-scheduled-handler.mjs` is idempotent (idempotency marker check). Re-running deploy is safe.

### Staging
`deploy-staging.sh` correctly uses `wrangler.staging.toml` with separate D1/R2 buckets. BACKUPS_BUCKET and crons omitted for staging. Clean.

---

## §5 Migration Flow Findings

### Mechanism
`apply-migrations.sh` uses `git diff --name-only HEAD~1 HEAD -- migrations/` to find new `.sql` files, then calls `wrangler d1 execute sophia-raas-db --file=<m> --remote` per file.

### Issues
1. **No "applied" cursor.** The script diffs git history only. If `apply-migrations.sh HEAD~1` is called twice (operator mistake), it applies the same migration twice. D1's own `wrangler d1 migrations apply` uses an internal `d1_migrations` table as cursor — this custom script bypasses that. **Risk: double-apply on replay.**
2. **Default REF=HEAD~1.** If a commit adds N migration files, only the files between HEAD~1 and HEAD are applied. If someone skips running the script for 3 commits, they must manually pass the right REF — easy to forget.
3. **`deploy:migrations` not gated in `deploy:full`.** deploy-with-sha.sh does NOT call apply-migrations.sh. The CLAUDE.md says "run `npm run deploy:migrations` after any commit that adds files to `migrations/`" — manual step, not automated. Schema drift risk if operator forgets.
4. **Tag-cache D1** (`sophia-tag-cache`) migrations applied manually via direct `wrangler d1 execute --remote` per changelog. Not tracked by apply-migrations.sh.

---

## §6 Smell Tests

| # | Finding | Severity |
|---|---|---|
| S1 | Staging EXPERIMENT_KV shares prod namespace ID (`c38577...`) — A/B writes in staging contaminate prod KV | HIGH |
| S2 | `*/1 * * * *` cron fires every minute; unmapped in CRON_ROUTES → scheduled() exits without dispatch. Wasted invocation. | MEDIUM |
| S3 | `npm run deploy` (bare) is a valid npm command that bypasses all SHA/push guards | MEDIUM |
| S4 | 4 `NEXT_PUBLIC_*` values stored as CF Secrets — they're public/build-baked, not runtime secrets; confusing + wasteful | LOW |
| S5 | 7 POLAR_* secrets still present on prod. Polar rejected per doctrine; dead secrets. | LOW |
| S6 | `deploy-with-sha.sh` comments reference `wrangler.jsonc` triggers.crons (line 132) but actual file is `wrangler.toml`. Stale comment. | LOW |
| S7 | wrangler.toml has duplicated `=== P3-CRONS-BEGIN/END ===` and `=== P3-KV-BEGIN/END ===` marker blocks (appear twice each at lines 72-87 and 117-127) | LOW |

---

## §7 Ranked Top 5 Issues

| # | Issue | Severity | Fix LOC |
|---|---|---|---|
| 1 | **fulfillment-retry + fulfillment-reconcile never fire** — CRON_ROUTES has `*/2` and `0 6 * * *` patterns but wrangler.toml missing both schedules. Fulfillment stale orders pile up silently. | CRITICAL | 2 lines in wrangler.toml |
| 2 | **TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID missing from prod secrets** — Protected flow (Telegram bot @Sophia_Bbot) is broken on prod. Commands /campaign /status /results silently fail. | HIGH | `wrangler secret put TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID` |
| 3 | **Staging KV shares prod namespace ID** — A/B experiment variants written during staging tests contaminate prod `EXPERIMENT_KV`. | HIGH | 1 line in wrangler.staging.toml (new KV namespace needed) |
| 4 | **apply-migrations.sh has no idempotency cursor** — Re-running script can apply same migration twice; schema mutations are not safe on replay. 117 migration files makes this increasingly risky. | HIGH | Replace git-diff approach with `wrangler d1 migrations apply` or add D1 cursor check (~20 LOC) |
| 5 | **`npm run deploy` bypasses all safety guards** — Any agent/operator running it produces stale SHA, no push check, no retry, no Sentry upload. | MEDIUM | Rename or add guard in package.json (~1 line) |

---

## §8 Refactor Proposals

**P1: Replace apply-migrations.sh with wrangler d1 migrations apply**
`wrangler d1 migrations apply sophia-raas-db --remote` uses D1's internal `d1_migrations` table as applied cursor — idempotent by design. Drop the git-diff approach entirely. Solves double-apply and forgotten-REF issues. ~30 LOC reduction.

**P2: Deduplicate deploy scripts — deprecate raw `npm run deploy`**
Rename `"deploy"` in package.json to `"deploy:raw"` (internal, with a warning comment) so `npm run deploy` fails with an "did you mean deploy:full?" message. Or replace its body with `echo 'Use npm run deploy:full'; exit 1`. Prevents accidental guard bypass.

**P3: Create separate EXPERIMENT_KV namespace for staging**
Run `wrangler kv namespace create EXPERIMENT_KV_STAGING`, paste ID into `wrangler.staging.toml`. One command + one config line. Eliminates prod KV contamination from staging tests.

---

## §9 Unresolved Questions

1. **fulfillment-retry/reconcile schedules** — Intentionally removed from wrangler.toml (rely on GitHub Actions workflow which is now disabled)? Or accidentally dropped? Need to confirm with original Phase 03 plan before adding.
2. **INNGEST_* secrets** — Inngest requires non-CF runtime. Are these credentials still active? Are any Inngest functions wired and expected to fire in prod? If dead, purge to reduce attack surface.
3. **workflow-stepper `*/1 * * * *`** — Every-minute unmapped schedule. Intentional (fire and miss = cheap health probe) or oversight (mapping forgotten)? If intentional, add a comment.
4. **Tag-cache D1 migrations** — Applied manually, not tracked by apply-migrations.sh. Is there a separate procedure or a risk of drift?
5. **`deploy:full` vs `deploy-full-verified.sh`** — CLAUDE.md names `deploy:full` as canonical but `deploy-full-verified.sh` adds E2E gate. Should `deploy:all` call `deploy-full-verified.sh` instead of `deploy-with-sha.sh` directly?
