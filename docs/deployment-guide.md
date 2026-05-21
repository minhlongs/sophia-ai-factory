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
| pnpm | v8+ (`npm install -g pnpm`) |
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
pnpm install

# 2. Copy env template
cp .dev.vars.example .dev.vars
# Edit .dev.vars — add required secrets (see Secrets section below)

# 3. Apply D1 migrations locally
npx wrangler d1 migrations apply sophia-raas-db --local

# 4. Start dev server
pnpm run dev   # http://localhost:3000
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
# This runs: next build → inject COMMIT_SHA/DEPLOYED_AT secrets → wrangler deploy

# Step 2: Apply any new D1 migrations (if migrations/ changed in this commit)
bash scripts/apply-migrations.sh
# Or to check what changed: git diff HEAD~1 HEAD -- migrations/ | grep "^+"

# The deploy script exits 2 if unpushed commits exist.
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

## Cron Setup

All scheduled endpoints are defined in `wrangler.toml` under `[triggers]`. They activate automatically on deploy — no external cron service required (no-tech doctrine).

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

Active cron jobs:
- `0 * * * *` — Hourly: wallet rebuild, usage rollup
- `0 0 * * *` — Daily: D1 backup to R2, clearance promotion, reconciliation
- `0 9 * * 1` — Weekly: signals digest email

---

## Secrets via Wrangler

Set all required secrets before first deploy:

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put HEYGEN_API_KEY
npx wrangler secret put HEYGEN_WEBHOOK_SECRET
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put CRON_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put CREDENTIALS_MASTER_KEY   # 64 hex chars (AES-GCM-256 for BYOK)
npx wrangler secret put BYOK_MASTER_KEY          # base64 32 bytes (LLM/media BYOK)
```

Optional (for source map upload to Sentry):
```bash
npx wrangler secret put SENTRY_AUTH_TOKEN        # optional — missing = errors captured but not symbolicated
```

Verify secrets are set:
```bash
npx wrangler secret list
```

---

## D1 Migrations

117 migrations applied as of 2026-05-19 (files `0001`–`0117` in `migrations/`).

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

IPN webhook URL (set in NOWPayments dashboard):
```
https://sophia.agencyos.network/api/webhooks/nowpayments
```

---

## Tier Configuration

Tiers: `BASIC | PREMIUM | ENTERPRISE | MASTER` (uppercase only).

Tier config SSOT: `apps/sophia-ai-factory/src/config/tiers/`. No changes to tier limits should be made outside this directory.

---

## Further Reading

- Full verify sequence: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Deploy doctrine: `apps/sophia-ai-factory/CLAUDE.md` → "Canonical Deploy Flow"
- No-tech doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md`
- GO-LIVE checklist: `apps/sophia-ai-factory/docs/deployment-checklist.md`
- Migrations log: `apps/sophia-ai-factory/docs/` (compliance/)
