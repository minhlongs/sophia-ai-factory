# Deployment Guide — Sophia AI Factory

> Operator-facing deployment reference. For engineering-internal details (migrations, load-test, GO-LIVE checklist), see `apps/sophia-ai-factory/docs/`.

**Production URL:** https://sophia.agencyos.network
**Deploy method:** CF-direct via `npm run deploy:full` (wrangler CLI)
**GitHub Actions:** DISABLED by design since 2026-05-03 — do NOT re-enable without updating this guide.

---

## Prerequisites

| Item | Requirement |
|------|------------|
| Node.js | v18+ |
| npm | App scripts and deploy wrappers are npm-based |
| pnpm | Lockfiles exist, but pnpm is not the documented deploy runner for Sophia |
| Wrangler CLI | `npm install -g wrangler` (or use local `npx wrangler`) |
| Cloudflare account | `wrangler login` authenticated |
| D1 database | `sophia-raas-db` created and bound in `wrangler.toml` |
| Git | `origin` remote points to `longtho638-jpg/sophia-ai-factory` |

---

## Local Setup

```bash
# 1. Clone and install
git clone https://github.com/longtho638-jpg/sophia-ai-factory.git
cd sophia-ai-factory/apps/sophia-ai-factory
npm install

# 2. Copy env template
cp .env.example .dev.vars
# Edit .dev.vars — add required secrets (see Secrets section below)
# For production-oriented secret names, compare with .env.production.example.

# 3. Apply D1 migrations locally
npx wrangler d1 migrations apply sophia-raas-db --local

# 4. Start dev server
npm run dev   # http://localhost:3000
```

---

## CF-Direct Deploy Flow

This is the **only** supported deploy path. GitHub Actions CI is disabled.

```bash
# Step 0: Push to origin FIRST (mandatory — deploy guard checks this)
git push origin main

# Step 1: Build + inject SHA + deploy
cd apps/sophia-ai-factory
npm run deploy:full
# This runs: type-check → tests → next build → OpenNext build → changed D1 migrations → wrangler deploy → SHA verification

# The deploy script exits 2 if unpushed commits or dirty files exist.
# Emergency bypass (document reason in deploy log):
# ALLOW_UNPUSHED_DEPLOY=1 npm run deploy:full
```

---

## Post-Deploy Verification

Run these checks after every deploy before reporting done:

```bash
# 1. SHA match — proves new code is live (not stale)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Must be equal. If not: re-run npm run deploy:full

# 2. HTTP check
curl -sI https://sophia.agencyos.network | head -1
# Must return: HTTP/2 200

# 3. Report format (required for any deploy report)
echo "Deploy: ✅ CF-direct | SHA: $LIVE_SHA | HTTP: 200"
```

---

## Rollback

```bash
# Option A: Rollback to previous Cloudflare Workers version (instant)
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes

# Option B: Redeploy a specific git commit
git checkout <target-sha>
npm run deploy:full
git checkout main
```

---

## Optional Feature Flags (Dark Launch)

Phase 4 introduced env-gated features that remain inert until explicitly activated:

| Feature | Secret | Default | Activation |
|---------|--------|---------|------------|
| LLM Cache (exact-match) | `LLM_CACHE_ENABLED` | not set (off) | `npx wrangler secret put LLM_CACHE_ENABLED "1"` |
| Langfuse telemetry sink | `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` | unset | Set both keys to enable |
| Prompt injection guard | `PROMPT_GUARD_ENABLED` (if implemented) | implicit (always on) | N/A — enabled by code |

**Note:** These features are designed for zero-risk dark launch. Missing secrets = feature stays inert. No code changes required to activate.

---

## Cron Setup

Most scheduled endpoints are defined in `wrangler.toml` under `[triggers]` and activate automatically on deploy. The D1 backup route is the exception: `/api/cron/d1-backup` is triggered by external scheduler (Upstash QStash) and writes SQL dumps to the R2 `sophia-backups` bucket.

Cron routes require Bearer authentication:
```
Authorization: Bearer ${CRON_SECRET}
```

Generate and set the secret (one-time setup):
```bash
CRON_SECRET=$(openssl rand -hex 32)
echo "Generated: $CRON_SECRET"
# Save to your secure vault, then:
npx wrangler secret put CRON_SECRET
```

Representative cron jobs:

| Schedule | Route | Purpose |
|----------|-------|---------|
| `*/5 * * * *` | `/api/cron/uptime-check` | Self-monitoring + Telegram alert |
| `5 * * * *` | `/api/cron/usage-export` | Hourly usage rollup |
| `0 1 * * *` | `/api/cron/dunning` | Dunning state machine (Phase 6) |
| `0 7 * * *` | `/api/cron/llm-cache-purge` | Expire-then-delete llm_cache rows (Phase 4E.3) |
| `0 */4 * * *` | `/api/cron/affiliate-scout` | Affiliate network discovery (PREMIUM+) |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` | PostHog signals digest |
| `0 0 1 * *` | `/api/cron/mcu-monthly-reset` | Monthly MCU credit top-up |
| External | `/api/cron/d1-backup` | Daily D1 → R2 backup (triggered by Upstash QStash) |
| `0 * * * *` | `/api/cron/overage-billing` | Hourly overage reconciliation (Phase 6) |

Full list: See `wrangler.toml` `[triggers]` section comments.

---

## Secrets via Wrangler

Set all required secrets before first deploy:

```bash
# Phase 4+ LLM Observability (optional — Langfuse mirror only)
npx wrangler secret put LANGFUSE_PUBLIC_KEY   # optional
npx wrangler secret put LANGFUSE_SECRET_KEY   # optional

# Core AI Services
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put HEYGEN_API_KEY
npx wrangler secret put HEYGEN_WEBHOOK_SECRET

# Payment Providers
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET

# Communications
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put RESEND_API_KEY

# Security & Auth
npx wrangler secret put CRON_SECRET
npx wrangler secret put BETTER_AUTH_SECRET

# BYOK Encryption (per-user keys)
npx wrangler secret put CREDENTIALS_MASTER_KEY   # 64 hex chars (AES-GCM-256)
npx wrangler secret put BYOK_MASTER_KEY          # base64 32 bytes (LLM/media BYOK)

# Optional Features
npx wrangler secret put LLM_CACHE_ENABLED       # "1" to enable exact-match cache
npx wrangler secret put LLM_CACHE_TTL_SECONDS   # default 86400 (24h)
```

Optional (for source map upload to Sentry):
```bash
npx wrangler secret put SENTRY_AUTH_TOKEN        # missing = errors captured but not symbolicated
```

Verify secrets are set:
```bash
npx wrangler secret list
```

---

## D1 Migrations

120 SQL migration files are present as of 2026-05-21 (highest numbered migration: `0117` in `migrations/`). Count files before reporting current status.

```bash
# Apply all pending migrations to remote
npx wrangler d1 migrations apply sophia-raas-db --remote

# Or use the project helper (applies only migrations changed since last commit):
bash scripts/apply-migrations.sh

# Check current migration state
npx wrangler d1 execute sophia-raas-db --command="SELECT migration_name FROM d1_migrations ORDER BY id DESC LIMIT 5" --remote
```

---

## Payment Provider

- **Primary:** NOWPayments (USDT crypto) — set `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET`
- **Backup:** PayOS (Vietnam VietQR) — configured via Setup Wizard by customer
- **REJECTED:** Polar.sh — do NOT add Polar to Sophia

**Billing Architecture (Phase 6):**
- NOWPayments IPN triggers tier activation in `raas_licenses` table
- RaaS Gateway middleware enforces quota + dunning state on all `/api/*` routes
- Overage billing cron (`0 * * * *`) reconciles usage beyond quota
- Dunning workflow state machine (`0 1 * * *`) manages payment failure grace periods

IPN webhook URL (set in NOWPayments dashboard):
```
https://sophia.agencyos.network/api/webhooks/nowpayments
```

---

## Tier Configuration

Tiers: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only).

Tier config SSOT: `apps/sophia-ai-factory/src/seed/config/tiers/`. No changes to tier limits should be made outside this directory.

---

## Further Reading

- Full verify sequence: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Deploy doctrine: `apps/sophia-ai-factory/CLAUDE.md` → "Canonical Deploy Flow"
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
- GO-LIVE checklist: `apps/sophia-ai-factory/docs/deployment-checklist.md`
- Migrations log: `apps/sophia-ai-factory/docs/` (compliance/)
