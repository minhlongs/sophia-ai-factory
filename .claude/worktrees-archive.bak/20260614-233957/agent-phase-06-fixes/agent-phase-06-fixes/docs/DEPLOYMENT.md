# Deployment Guide — Sophia AI Factory

This guide covers deployment procedures, environment variable configuration, secret management, database migrations, and rollbacks for the Sophia AI Factory platform.

---

## 1. Production Details

* **Production URL**: `https://sophia.agencyos.network`
* **Deploy Method**: Cloudflare direct deploying via the wrangler CLI.
* **GitHub Actions**: Disabled by design. Deployments are executed directly from developer environments to maintain fast iterations.

---

## 2. Prerequisites

Ensure your deployment workstation has:
- Node.js version 18.0.0 or higher.
- Wrangler CLI installed globally: `npm install -g wrangler`
- Authorized access to wrangler: `wrangler login`
- Access permissions to the `sophia-raas-db` D1 database on Cloudflare.

---

## 3. Deployment Flow (CF-Direct)

Always push changes to the remote Git repository before deploying. The build script validates that there are no unpushed local changes.

```bash
# 1. Ensure your local branch is synchronized
git checkout main
git pull origin main

# 2. Build the app, compile assets, and deploy to Cloudflare
cd apps/sophia-ai-factory
pnpm run deploy:full

# 3. Apply database migrations to production D1
pnpm run deploy:migrations
```

---

## 4. Post-Deployment Verification

Perform these health checks immediately after a deploy completes:

### 1. Version SHA Verification
Verify that the deployed version is live:
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
```
Ensure `LOCAL_SHA` matches `LIVE_SHA`.

### 2. HTTP Health Endpoint Check
```bash
curl -sI https://sophia.agencyos.network | head -1
```
Expected output: `HTTP/2 200` or similar.

---

## 5. Rollback Procedures

### Instant Cloudflare Reversion
To instantly revert the active production build to the previous version:
```bash
npx wrangler rollback --name sophia-ai-factory --yes
```

### Re-deploying a Specific Commit
If a full rebuild is required to revert:
```bash
git checkout <last-known-good-sha>
pnpm run deploy:full
git checkout main
```

---

## 6. Secrets Provisioning

Configure the following secrets in Cloudflare prior to deployment:

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
npx wrangler secret put CREDENTIALS_MASTER_KEY
npx wrangler secret put BYOK_MASTER_KEY
```
