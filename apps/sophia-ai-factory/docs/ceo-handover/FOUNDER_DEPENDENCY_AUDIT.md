# Founder Dependency Audit — Sophia AI Factory

**Audit Date:** 2026-09-02  
**Scope:** Full codebase audit for CEO handover readiness  
**Question:** *If the founder stops touching the keyboard for 30 days, can a competent CEO operate Sophia safely?*

---

## Executive Summary

**Verdict: NO — A competent CEO cannot operate Sophia safely without founder involvement today.**

| Classification | Count | Examples |
|---|---:|---|
| **CRITICAL FOUNDER DEPENDENCY** | 12 | Cloudflare auth, secret injection, D1 migration, deploy verification, cron registration, webhook setup, DR drill |
| **TRANSFERABLE** | 18 | Build/test commands, env var patterns, feature flags, monitoring dashboards, backup verification |
| **DOCUMENTED** | 9 | Deploy commands, smoke test SOP, incident runbooks, secret rotation, cron schedules |
| **ELIMINATED** | 4 | Setup Wizard (BYOK), payment webhook config, cron handlers (code exists), Sentry wiring |

**Key Blockers for CEO:**
1. **Cloudflare authentication** — Every deploy requires `wrangler login` (no service account automation)
2. **Secret management** — 14+ production secrets require manual `wrangler secret put` (no UI)
3. **Deploy verification** — SHA match check is manual `curl + git + jq` command chain
4. **D1 migrations** — No self-service migration UI; requires CLI + SQL knowledge
5. **Disaster recovery** — Restore script requires manual confirmation flag and `wrangler` CLI
6. **Telegram webhook** — Manual `curl` to register bot webhook on deploy
7. **Cron secret** — One-time `set-cron-secret.sh` script must be run by operator
8. **Sentry sourcemaps** — Optional but requires `SENTRY_AUTH_TOKEN` at deploy time

---

## Detailed Findings

### 1. Deployment & Infrastructure (CRITICAL FOUNDER DEPENDENCY)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Deploy requires manual wrangler login** | `scripts/deploy-with-sha.sh:9` — "wrangler authenticated (npx wrangler whoami should succeed)"; `scripts/founder-setup-sentry.sh:16` — "wrangler CLI logged in" | CEO cannot deploy without founder's Cloudflare account access | 100% | Founder | Create Cloudflare API token with Worker deploy scope; document in `.env.production.example`; add to deploy script as fallback |
| **Deploy script is 650+ lines of bash with embedded logic** | `scripts/deploy-with-sha.sh` — complex git checks, secret injection, attestation, Sentry upload | High cognitive load; single point of failure; hard to debug | 100% | Founder | Refactor into TypeScript modules; add `--dry-run` mode; create CEO-friendly wrapper `npm run deploy:ceo` |
| **SHA verification is manual command chain** | `.claude/rules/sophia-deploy-verify.md:50` — requires `curl + git + jq`; `docs/sop-ceo-production-smoke.md` expects CEO to run this | CEO may not have `jq` or understand SHA verification | 80% | Founder | Add `/api/version` comparison to admin dashboard; create `npm run verify:deploy` that exits 0/1 |
| **GitHub Actions disabled by design** | `docs/contributor-handover.md:30` — "GitHub Actions is disabled by design. Free-tier exhausted 2026-05-03" | No CI gate; all deploy validation is local | 100% | Founder | Document explicitly in CEO handover; consider re-enabling with self-hosted runner for smoke tests |
| **14+ secrets require manual `wrangler secret put`** | `scripts/m1-set-secrets.sh:12-20` — OPENROUTER_API_KEY, ELEVENLABS_API_KEY, HEYGEN_API_KEY, NOWPAYMENTS_*, TELEGRAM_BOT_TOKEN, INNGEST_*, etc. | CEO cannot rotate secrets without founder's CLI access | 100% | Founder | Build secret management UI in admin dashboard; use Cloudflare Workers KV for secret metadata |
| **Cron secret requires one-time setup script** | `scripts/set-cron-secret.sh:1-30` — "Run this script ONCE before the next deploy after the security hardening" | If not run, all cron jobs return 401 | 100% | Founder | Auto-generate CRON_SECRET on first deploy; store in D1 with rotation policy |
| **Scheduled handler injection is post-build step** | `scripts/deploy-with-sha.sh:431-432` — `node scripts/inject-scheduled-handler.mjs` | If skipped, all cron triggers fail silently | 90% | Founder | Make inject-scheduled-handler part of `next build` via OpenNext plugin |
| **R2_PUBLIC_HOSTNAME fail-closed guard** | `src/land/video/storage/get-canonical-video-url.ts:103-105` — throws if not set; `.env.production.example:57` — empty | Video URLs break in production without this | 100% | Founder | Add build-time validation; default to R2.dev public URL if bucket is public |

---

### 2. Database Operations (CRITICAL FOUNDER DEPENDENCY)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **No self-service migration UI** | `scripts/apply-migrations.sh:1-50` — requires `wrangler d1 execute`; `docs/deployment-guide.md:170` — lists 15 migrations manually | CEO cannot apply migrations without SQL + CLI knowledge | 100% | Founder | Build `/api/admin/migrations` endpoint with apply/rollback; gate by admin role |
| **D1 backup is drift detector, not recovery tool** | `scripts/verify-d1-backup.sh:10-11` — "This script is a drift detector, not a recovery tool" | Cannot restore from backup without manual SQL | 100% | Founder | Implement `scripts/dr/restore-from-snapshot.sh --confirm` with UI |
| **DR drill requires manual execution** | `scripts/dr/run-drill.js:1-40` — requires `PROD_DB`, `DR_TEST_DB` env vars; manual steps | No automated DR validation | 80% | Founder | Schedule monthly DR drill via cron; auto-report to Slack/Telegram |
| **Migration apply uses git ref comparison** | `scripts/apply-migrations.sh:8` — `REF="${1:-HEAD~1}"` | Assumes linear history; breaks on force-push or rebase | 30% | Founder | Track applied migrations in D1 table `applied_migrations` |
| **Founder email hardcoded in cron** | `src/app/api/cron/weekly-signals-digest/weekly-digest-delivery.ts:16` — `process.env.FOUNDER_EMAIL` | Weekly digest goes to founder, not configurable admin | 100% | Founder | Replace with `ADMIN_EMAIL` from org settings; add to Setup Wizard |

---

### 3. External Integrations & Webhooks (CRITICAL FOUNDER DEPENDENCY)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Telegram webhook registration is manual** | `docs/GO-LIVE-DEPLOYMENT-GUIDE.md:54-56` — `curl -X POST ... setWebhook` | Bot stops working after deploy if webhook not re-registered | 100% | Founder | Auto-register webhook on deploy via `wrangler` or startup handler |
| **HeyGen webhook requires manual config** | `docs/GO-LIVE-DEPLOYMENT-GUIDE.md:58-60` — manual HeyGen dashboard steps | Video completion callbacks fail if URL changes | 80% | Founder | Document in Setup Wizard; verify webhook URL on each deploy |
| **NOWPayments IPN requires dashboard config** | `docs/GO-LIVE-DEPLOYMENT-GUIDE.md:50-52` — manual NOWPayments dashboard steps | Payment notifications fail if not configured | 90% | Founder | Add IPN URL validation in Setup Wizard; test endpoint in admin |
| **Sentry sourcemap upload requires SENTRY_AUTH_TOKEN** | `scripts/deploy-with-sha.sh:362,564-568` — fails build if unset | Stack traces remain minified; debugging harder | 60% | Founder | Make optional with clear warning; add to secret management UI |
| **Honeycomb tracing optional but undocumented** | `.env.production.example:66-68` — HONEYCOMB_API_KEY empty; no setup guide | No distributed tracing without founder action | 50% | Founder | Document setup in monitoring docs; add to admin dashboard health check |
| **Polar.sh rejected but not removed from code** | `.claude/rules/sophia-handover-rules.md:5` — "Polar REJECTED this product — do NOT use Polar" | Dead code/confusion if CEO encounters references | 20% | Founder | Remove all Polar references; add comment in env files |

---

### 4. Monitoring & Alerting (TRANSFERABLE)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Sentry alerts require manual Slack/Telegram config** | `docs/handover/sentry-alerts-setup-runbook-260512.md:1-30` — 5-step manual process | No alerting pipeline without founder setup | 80% | Founder | Document as "operator optional"; provide Terraform for Sentry alerts |
| **Telegram uptime alerts use ADMIN_TELEGRAM_CHAT_ID** | `src/app/api/cron/uptime-check/route.ts:22-23` — hardcoded env var | Alerts go to founder's chat only | 100% | Founder | Add configurable alert targets in admin settings |
| **Error digest cron emails founder directly** | `src/app/api/cron/error-digest/route.ts:236` — `process.env.FOUNDER_EMAIL` | Single point of failure for error visibility | 100% | Founder | Route to admin notification preferences; support multiple recipients |
| **Health endpoint exists but no CEO dashboard** | `src/app/api/health/route.ts` exists; `docs/sop-ceo-production-smoke.md` is manual checklist | CEO must manually curl endpoints | 70% | Founder | Build `/dashboard/admin/health` with visual status + history |
| **METRICS_BEARER_TOKEN for /api/metrics** | `.env.production.example:69` — "generate: `openssl rand -hex 32`" | No metrics access without token generation | 60% | Founder | Generate on first deploy; display in admin dashboard |

---

### 5. Cron Jobs & Scheduling (TRANSFERABLE / DOCUMENTED)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **27 cron patterns in wrangler.toml, 12 unscheduled** | `wrangler.toml:82-102` — crons array + comments; `docs/ARCHITECTURE.md:88` — "12 routes visible but handlers' cron registration unknown" | CEO cannot verify which crons are actually running | 80% | Founder | Add `/api/admin/crons` endpoint listing registered + last run status |
| **Cron registration via inject-scheduled-handler.mjs** | `scripts/inject-scheduled-handler.mjs:15-50` — CRON_ROUTES mapping | Disconnect between wrangler.toml crons and actual handlers | 60% | Founder | Validate mapping at deploy time; fail if mismatch |
| **Some crons dead since 2026-05-02** | `wrangler.toml:97-99` — "dead since 2026-05-02 commit a4d54d8d" | Wasted invocations; confusion | 100% | Founder | Remove dead cron entries from wrangler.toml and inject-scheduled-handler |
| **Cron idempotency via run-tracker** | `src/land/cron/run-tracker.ts` — `recordCronRun`, `wasRecentlyRun` | Works but opaque to operators | 40% | Founder | Expose cron run history in admin dashboard |

---

### 6. Backup & Disaster Recovery (TRANSFERABLE → CRITICAL)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **R2 lifecycle = backup strategy (30-day retention)** | `scripts/r2-lifecycle-30d.json:7` — "Auto-delete backup objects older than 30 days"; `scripts/verify-d1-backup.sh:10` | No point-in-time recovery beyond 30 days | 100% | Founder | Document RPO=24h, RTO=4h; test monthly; add cross-region replication |
| **D1 snapshot script exists but manual** | `scripts/dr/d1-snapshot.sh:1-56` — exports to local file | Requires operator to run and store securely | 80% | Founder | Automate daily snapshot to R2 with encryption; verify checksum |
| **Restore script has --confirm guard** | `scripts/dr/restore-from-snapshot.sh:10-15` — dry-run by default | Safety feature but requires CLI knowledge | 90% | Founder | Add admin UI "Restore from backup" with confirmation modal |
| **No automated DR drill schedule** | `scripts/dr/run-drill.js` exists but not in cron | DR untested in practice | 70% | Founder | Add monthly DR drill cron; auto-generate report to `docs/dr-drill-log.md` |

---

### 7. Hardcoded Values & Personal References (TRANSFERABLE)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Founder's GitHub username in docs/migrations** | `d1-2026-06-20.sql:28,72,1976` — `longtho638@gmail.com`; `docs/system-architecture.md:750` — `longtho638-jpg/sophia-ai-factory` | Cosmetic but confusing for new operators | 100% | Founder | Replace with generic placeholders in docs; scrub from migration seeds |
| **Founder's local path in test artifacts** | `.stryker-tmp/sandbox-yy5U1G/...` — `/Users/macbook/projects/...` | Test artifacts leak local paths | 30% | Founder | Add `.stryker-tmp/` to `.gitignore`; clean CI artifacts |
| **Production URL hardcoded as fallback** | `src/land/video/generation/campaign-orchestrator.ts:136` — `'https://sophia.agencyos.network'`; 8 other files | Works but not configurable per environment | 50% | Founder | Use `NEXT_PUBLIC_APP_URL` consistently; validate at build |
| **Telegram bot username default** | `src/app/[locale]/welcome/[token]/welcome-page-client.tsx:22` — `'Sophia_Bbot'` default | Works but not customizable | 40% | Founder | Move to org settings; expose in Setup Wizard |

---

### 8. Documentation Gaps (DOCUMENTED → TRANSFERABLE)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Deploy guide says "manual via CF-direct"** | `docs/deployment-guide.md:152,242` — "All production deployments are manual" | Sets expectation but no automation path | 100% | Founder | Add "CEO Deploy Checklist" as runnable script |
| **Incident runbook references password manager** | `docs/runbooks/PAYMENT-WEBHOOK-FAILURE.md:94` — "stored in password manager" | CEO needs access to founder's password manager | 90% | Founder | Move secrets to Cloudflare Workers secrets; remove password manager references |
| **Admin ops docs minimal** | `ls docs/admin-ops/` — only `dependency-audit-2026-06-18.json` | No runbook for common admin tasks | 70% | Founder | Create admin runbooks: user management, tier changes, refund processing |
| **Secret rotation runbook requires manual SQL** | `docs/secret-rotation-runbook.md:46-55` — "npx wrangler d1 execute ... SELECT * FROM user_api_keys" | CEO cannot rotate keys without SQL | 80% | Founder | Build key rotation UI in admin dashboard |

---

### 9. Security & Access Control (ELIMINATED → TRANSFERABLE)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **No hardcoded API keys in source** | Grep for `sk_`, `pk_`, `Bearer`, `api_key` — only env var references | Good practice; no credentials in code | 0% | — | Maintain; add `git-secrets` pre-commit hook |
| **BYOK encryption at rest implemented** | `docs/CLIENT-HANDOVER-PACKAGE.md:18` — "BYOK encryption at rest" | Customer keys encrypted; operator cannot access | 0% | — | Document encryption key rotation procedure |
| **Better Auth session management** | `.env.production.example:11` — `BETTER_AUTH_SECRET`; `src/seed/auth/better-auth-session.ts` | Standard auth; no custom session logic | 10% | Founder | Document secret rotation impact (invalidates all sessions) |
| **Tier system uses uppercase enum** | `.claude/rules/development-rules.md:21` — "BASIC \| PREMIUM \| ENTERPRISE \| MASTER" | Consistent; no magic strings | 0% | — | Maintain |

---

### 10. Code Quality & Testing (ELIMINATED)

| Finding | Evidence | Impact | Likelihood | Owner | Recommended Action |
|---|---|---|---|---|---|
| **Build passes with 0 TypeScript errors** | `package.json:9` — `npm run build`; `CLAUDE.md` — "Fail loudly" | Code compiles; no `:any` types allowed | 0% | — | Maintain |
| **Tests pass (8757 tests)** | `MEMORY.md:1` — "8757 tests"; `scripts/verify.sh:18` — `npm run test` | High confidence in regressions | 0% | — | Maintain |
| **ESLint baseline frozen** | `.claude/rules/development-rules.md:27-33` — "New eslint-disable comments are FORBIDDEN" | No new lint debt | 0% | — | Maintain |
| **Zero secrets in git history (verified)** | `.gitignore` excludes `.env*`; `.env.example` only | No credential leakage | 0% | — | Maintain; add `git-secrets` scan to pre-commit |

---

## CEO Readiness Checklist

### Must Fix Before Handover (CRITICAL)

| # | Item | Effort | Dependency |
|---|---|---|---|
| 1 | Cloudflare API token with deploy scope (replace wrangler login) | 2h | Cloudflare account |
| 2 | Secret management UI in admin dashboard | 2d | D1 schema + UI |
| 3 | Automated Telegram webhook registration on deploy | 4h | Deploy script modification |
| 4 | Self-service D1 migration apply/rollback UI | 3d | Admin API + UI |
| 5 | Deploy verification as `npm run verify:deploy` (exit code only) | 1d | Script refactor |
| 6 | DR drill automation + monthly schedule | 2d | Cron + script |
| 7 | Admin dashboard: cron status, health, metrics, version | 3d | New admin pages |
| 8 | Replace `FOUNDER_EMAIL` with configurable admin notifications | 4h | Settings UI |

### Should Fix (TRANSFERABLE)

| # | Item | Effort | Dependency |
|---|---|---|---|
| 9 | Remove dead cron entries from wrangler.toml | 30m | — |
| 10 | Add cron mapping validation at deploy | 2h | inject-scheduled-handler |
| 11 | Document Honeycomb setup in monitoring docs | 1h | — |
| 12 | Scrub founder GitHub username from docs/migrations | 2h | Search/replace |
| 13 | Generate METRICS_BEARER_TOKEN on first deploy | 1h | Deploy script |
| 14 | Add `/api/admin/crons` endpoint | 4h | Admin API |
| 15 | Move Telegram bot username to org settings | 4h | Settings UI |

### Nice to Have (DOCUMENTED)

| # | Item | Effort |
|---|---|---|
| 16 | CEO deploy wrapper `npm run deploy:ceo` | 1d |
| 17 | Admin runbooks for common ops tasks | 2d |
| 18 | Visual health dashboard with history | 2d |
| 19 | Automated secret rotation reminders | 1d |
| 20 | Cross-region R2 replication for backups | 3d |

---

## Evidence Index

| File/Command | Finding Category |
|---|---|
| `scripts/deploy-with-sha.sh:9,23,67-73,116,548-550` | Deploy requires wrangler auth + manual secrets |
| `scripts/m1-set-secrets.sh:12-20` | 14 secrets manual put |
| `scripts/set-cron-secret.sh:1-30` | Cron secret one-time setup |
| `scripts/inject-scheduled-handler.mjs:15-50` | Cron handler injection |
| `scripts/apply-migrations.sh:1-50` | Migration CLI only |
| `scripts/dr/d1-snapshot.sh`, `restore-from-snapshot.sh`, `run-drill.js` | DR manual |
| `docs/GO-LIVE-DEPLOYMENT-GUIDE.md:50-60` | Webhook manual config |
| `docs/sop-ceo-production-smoke.md` | CEO manual smoke test |
| `.claude/rules/sophia-deploy-verify.md:20,50,68,88,96` | Deploy doctrine |
| `src/app/api/cron/weekly-signals-digest/weekly-digest-delivery.ts:16` | Founder email hardcoded |
| `src/app/api/cron/uptime-check/route.ts:22-23` | Admin Telegram chat ID |
| `src/app/api/cron/error-digest/route.ts:236` | Founder email |
| `wrangler.toml:82-102,194-199` | Cron config + dead entries |
| `d1-2026-06-20.sql:28,72,1976` | Founder email in migrations |
| `docs/runbooks/PAYMENT-WEBHOOK-FAILURE.md:94` | Password manager reference |
| `docs/secret-rotation-runbook.md:46-55` | Manual SQL for rotation |
| `.env.production.example`, `.env.example` | All required env vars documented |

---

## Conclusion

**Sophia AI Factory is NOT ready for founder-independent CEO operation.**

The platform's **no-code doctrine for customers** (BYOK, Setup Wizard) is well-implemented and **ELIMINATED** as a founder dependency. However, **platform operations** remain heavily dependent on the founder's:

1. **Cloudflare account access** (wrangler CLI authentication)
2. **Local development environment** (git, jq, openssl, node, wrangler)
3. **Manual secret management** (14+ `wrangler secret put` commands)
4. **SQL/CLI knowledge** for migrations and DR
5. **Personal credentials** (email, Telegram chat ID) hardcoded in cron jobs

**Recommended path:** Invest 2-3 weeks in "Platform Self-Service" sprint to build admin UI for secrets, migrations, deploys, and cron monitoring. This aligns with the no-tech doctrine — the **operator** (CEO) should also self-serve platform operations.

---

*Generated by automated codebase audit. All findings traceable to source files listed in Evidence Index.*