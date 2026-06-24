# Deployment Guide

This guide covers the deployment of the Sophia AI Video Factory. The application is designed to be "Turnkey", meaning most of the complex configuration is handled by the **Setup Wizard** after installation.

## 1. Quick Start (Local Development)

The fastest way to run Sophia AI Factory is locally.

### Prerequisites
- **Node.js**: v18 or higher
- **Git**

### Installation Steps

1. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd sophia-ai-factory
   npm install
   ```

2. **Run Tests (Optional but Recommended)**
   Ensure the application logic is stable before running.
   ```bash
   npm test
   ```

2.5. **Check Bundle Size (Optional — Wave 14+)**
   Prevent Cloudflare Worker cold-start latency from oversized bundles.
   ```bash
   bash scripts/check-bundle-size.sh
   # Enforces 9.5/10MB threshold; aborts if exceeded
   ```

3. **Launch Application**
   ```bash
   npm run dev
   ```

3. **Run the Setup Wizard**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.
   - You will be automatically redirected to the Setup Wizard.
   - Follow the 4-step on-screen instructions to connect your API keys and Database.

   **What you'll need:**
   - **OpenRouter API Key** (for LLM/Scripting)
   - **ElevenLabs API Key** (for Voice)
   - **D-ID API Key** (for Avatar Video)
   - **HeyGen API Key** (for Premium Avatar Video)
   - **Airtable Personal Access Token** (for Database)

   *The Wizard provides direct links to get these keys.*

## 1.5 Sprint M Revenue Path Deployment Requirements (NEW)

Before deploying Sprint M (first-dollar revenue engine), ensure all prerequisites are met. This section is required for ClickBank integration + wallet settlement.

### Prerequisites
1. **D1 Migrations Applied** (remote database)
   - Migration 0018-campaigns
   - Migration 0019-raas-licenses
   - Migration 0020-user-profiles-extend
   - Migration 0021-affiliate-offers-selected
   - Migration 0022-affiliate-conversions
   - Migration 0023-user-wallets+payouts+user-payout-settings
   - Migration 0030-video-r2-metadata (2026-04-29) — adds `r2_key`, `r2_size_bytes` columns to `videos` table
   - Migration 0091-composite-indexes (2026-05-09) — performance optimization indexes
   - Migration 0092-totp-secrets-encrypt-backfill (2026-05-09) — TOTP encryption
   - Migration 0093-usage-events-external-id-unique (2026-05-09) — unique constraint on usage tracking
   - Migration 0094-publisher-add-distribution-platforms (2026-05-09) — adds distribution platform enum support
   - Migration 0095-password-reset-tokens-oauth-state-store (2026-05-09) — password reset tokens + OAuth state encryption (NEW in Wave 11)
   - Migration 0096-engine-missions-video-output-fields (2026-05-09) — adds `output_video_url, output_audio_url, video_job_id` for Wave 12 video gen MVP
   - Migration 0097-missions-byok-columns (2026-05-09) — adds `missions.byok_provider_id, byok_model_id` for Wave 14 BYOK launcher wiring
   ```bash
   npx wrangler d1 migrations apply sophia-raas-db --remote
   ```

2. **Cloudflare Secrets Set** (14 required — 3 new for Wave 12+15)
   ```bash
   npx wrangler secret put OPENROUTER_API_KEY --env production
   npx wrangler secret put ELEVENLABS_API_KEY --env production
   npx wrangler secret put HEYGEN_API_KEY --env production
   npx wrangler secret put HEYGEN_WEBHOOK_SECRET --env production
   npx wrangler secret put NOWPAYMENTS_API_KEY --env production
   npx wrangler secret put NOWPAYMENTS_IPN_SECRET --env production
   npx wrangler secret put TELEGRAM_BOT_TOKEN --env production
   npx wrangler secret put INNGEST_EVENT_API_BASE_URL --env production
   npx wrangler secret put INNGEST_EVENT_KEY --env production
   npx wrangler secret put CLICKBANK_INS_SECRET --env production
   npx wrangler secret put CRON_SECRET --env production
   npx wrangler secret put WAN_API_KEY --env production
   npx wrangler secret put FISH_SPEECH_API_KEY --env production
   npx wrangler secret put CLOUDCONVERT_API_KEY --env production
   ```
   
   **Video Pipeline Secrets**:
   - `HEYGEN_WEBHOOK_SECRET` — HeyGen webhook signature verification (HMAC-SHA256).
   - `HEYGEN_API_KEY` — HeyGen API credential for video polling.
   - `CLOUDCONVERT_API_KEY` — Cloudconvert REST API key for FFmpeg muxing (video + audio). **If absent in production**, muxing falls back to dev stub MP4 — adequate for testing but not production-ready.
   
   **Optional Video CDN**:
   - `R2_PUBLIC_BASE_URL` — Public CDN URL for R2 bucket (e.g., `https://videos.sophia.agencyos.network`). If omitted, uses R2 auth URLs.

3. **ClickBank Vendor Configuration**
   - Set Instant Notification Service (INS) URL in ClickBank vendor dashboard:
     ```
     https://sophia.agencyos.network/api/webhooks/clickbank
     ```
   - Verify webhook secret matches `CLICKBANK_INS_SECRET` env var

4. **Cron Triggers Enabled** (already in wrangler.toml, requires deploy to activate)
   - `0 * * * *` (hourly): Wallet rebuild
   - `0 0 * * *` (daily): Clearance promotion

### Deployment Steps
1. Re-enable GitHub Actions workflow (currently disabled to prevent premature deploy)
2. Apply D1 migrations (see above)
3. Set all 9 Cloudflare secrets
4. Configure ClickBank vendor INS URL
5. `git push origin main` → GitHub Actions tests & deploy → verify via `/api/version` SHA match

### Post-Deploy Smoke Tests
```bash
# Test Telegram campaign creation
/campaign "Sample Topic"
# → Check D1: SELECT COUNT(*) FROM campaigns

# Test ClickBank webhook (ask vendor to send test INS)
# → Check D1: SELECT * FROM affiliate_conversions
# → Check wallet: SELECT * FROM user_wallets WHERE balance_available > 0

# Test payout dashboard
# → Admin: /admin/payouts → mark one as paid
# → User should receive Telegram notification
```

### Rollback Plan
If issues arise post-deploy:
1. Disable GitHub Actions (prevent auto-deploys)
2. Rollback D1 migrations (restore to 0017):
   ```bash
   npx wrangler d1 migrations rollback sophia-raas-db --remote
   ```
3. Clear Cloudflare Secrets (optional)
4. Git revert affected commits
5. Redeploy after fixes

---

## 2. Production Deployment (Cloudflare Workers)

Sophia AI Factory deploys to **Cloudflare Workers** via **CF-direct doctrine** — manual `wrangler` CLI from the app package. GitHub Actions is disabled by design.

### Prerequisites

- `wrangler` authenticated (`npx wrangler whoami` succeeds)
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in environment
- Code pushed to `origin/main` (precondition enforced by deploy script)

### Step 1: Push to Remote

```bash
git push origin main
```

The deploy script will reject if local HEAD is not equal to origin/main.

### Step 2: Run Deploy Script

```bash
cd apps/sophia-ai-factory
npm run deploy:full
```

This script (`scripts/deploy-with-sha.sh`) performs:

1. **Push preconditions** — verifies working tree clean and HEAD == origin/main
2. **Pre-deploy gate** — runs `scripts/pre-deploy-gate.mjs`:
   - Git status check
   - `npm test` (skip with `SKIP_TESTS=1`)
   - `npm run build`
   - `npm run type-check` (skip with `SKIP_TSC=1`)
   - D1 migration review (ensures unreviewed migrations have approval comments)
   - Required secrets check (`OPENROUTER_API_KEY`, `NOWPAYMENTS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
3. **Build** — `npm run build` (Next.js → OpenNext worker)
4. **Deploy** — `npx opennextjs-cloudflare deploy --config wrangler.toml`
5. **Inject secrets** — `COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH` into Worker
6. **Verify SHA match** — poll `/api/version` until `shortSha` matches local commit
7. **HTTP health check** — verify `https://sophia.agencyos.network` returns 200
8. **Post-deploy smoke** — run `scripts/post-deploy-smoke.mjs` (health + version checks)

**Emergency bypasses** (use sparingly):

```bash
SKIP_PRE_DEPLOY_GATE=1 npm run deploy:full     # skip gate checks
SKIP_SMOKE_TEST=1 npm run deploy:full          # skip post-deploy smoke
ALLOW_UNPUSHED_DEPLOY=1 npm run deploy:full    # deploy even if not pushed
```

### Step 3: Verify Deployment

The deploy script outputs verification results. Manual verification:

```bash
# Check version endpoint
curl -s https://sophia.agencyos.network/api/version | jq

# Compare SHA
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Both must match
```

### Step 4: Apply D1 Migrations (if any)

If this deploy includes new SQL migrations in `migrations/`, apply them:

```bash
cd apps/sophia-ai-factory
bash scripts/apply-migrations.sh
```

The script will backup the database before applying any new migrations.

### Step 5: Production Setup (First Deploy Only)

After the first successful deploy, run the production setup wizard:

```bash
npm run setup:production
```

This verifies third-party integrations and generates a setup report.

---

## 3. Automated Deployment & Monitoring

### CI/CD (Disabled by Design)

The GitHub Actions workflow `.github/workflows/test.yml` is archived (disabled). All production deployments are manual via CF-direct. This ensures operator oversight and prevents accidental deploys.

### Post-Deploy Smoke Tests

Two levels of smoke testing:

1. **Basic** (mandatory, runs automatically) — `scripts/post-deploy-smoke.mjs`
   - Checks `/api/health` (authenticated)
   - Verifies `/api/version` SHA match
   - Writes JSON report if `SMOKE_REPORT_PATH` set

2. **E2E** (optional, Playwright) — enable with `RUN_POSTDEPLOY_E2E=1`
   ```bash
   RUN_POSTDEPLOY_E2E=1 npm run deploy:full
   ```
   Runs `@smoke` tagged Playwright tests against production.

### Alerts & Runbooks

- **Sentry** — error tracking and alerts (source maps uploaded during deploy)
- **Honeycomb** — distributed tracing (optional)
- **Telegram Bot** — operational notifications

See:
- `docs/alerting-setup.md` — configure alerts
- `docs/incident-runbook.md` — incident response
- `docs/runbooks/` — specific failure scenarios

---

## 4. Rollback

If the deployment introduces issues:

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --yes
```

This reverts to the previous Worker version. Then investigate and fix before redeploying.

---

## 5. Load Testing

Basic load test utility:

```bash
node scripts/load-test.mjs https://sophia.agencyos.network 10 100
# 10 concurrent workers, 100 requests each = 1000 total
```

For comprehensive load testing, use k6 scripts:

```bash
npm run test:load:steady   # baseline sustained load
npm run test:load:spike    # spike test
npm run test:load:soak     # soak test (duration)
```


### Option B: Self-Hosted n8n
1. Run n8n using Docker:
   ```bash
   docker run -it --rm --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n
   ```
2. Make sure n8n is accessible via a public URL (use a tunnel like `ngrok` if developing locally).
3. Import workflows and configure webhooks.

## 4. Advanced / Manual Configuration

If you prefer to configure manually (skipping the Wizard), create a `.env.local` file with the following:

```bash
# Feature Flags
NEXT_PUBLIC_SETUP_WIZARD=true       # Set to false to disable wizard check
NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE=true
NEXT_PUBLIC_MOCK_AI_SERVICES=false  # Set to true to use mock services (free, no API keys needed)

# Admin Access (Optional)
ADMIN_USER=admin
ADMIN_PASS=changeme

# Core Integrations
OPENROUTER_API_KEY=sk-or-v1-...
ELEVENLABS_API_KEY=...
DID_API_KEY=...
HEYGEN_API_KEY=...

# Database (Airtable)
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...

# Automation Webhooks (n8n)
N8N_WEBHOOK_GENERATE_SCRIPT=https://...
N8N_WEBHOOK_PUBLISH_VIDEO=https://...

# Payments (NOWPayments)
# Obtained from NOWPayments Dashboard -> Settings
NOWPAYMENTS_API_KEY=...
NOWPAYMENTS_IPN_SECRET=...

# Backup Payment Provider (PayOS for Vietnam)
PAYOS_MERCHANT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
```

## 6. Automated Deployment & Verification

For enterprise and robust deployments, we rely on scripted automation following the Binh Pháp strategy.

### Infrastructure Sync
The `scripts/infra-sync.sh` script is the master controller for ensuring your environment is correctly set up. It handles:
- Dependency installation
- Environment variable validation
- Database schema verification
- Build artifacts generation

```bash
./scripts/infra-sync.sh
```

### Verification Suite
Before going live, run the full verification suite to ensure system integrity. This runs linting, type checking, unit tests, and security audits.

```bash
./scripts/verify.sh
```

### Mock Mode for Testing
To test the application flow without incurring API costs or requiring external keys, enable Mock Mode. This is used by CI/CD pipelines.

```bash
NEXT_PUBLIC_MOCK_AI_SERVICES=true npm run dev
```

## 7. Troubleshooting

- **Wizard Loops**: If you keep seeing the wizard after setup, check if `NEXT_PUBLIC_SETUP_COMPLETE=true` (or equivalent check in code) is persisting. In Vercel, ensure you Redeployed after setting env vars.
- **API Errors**: Check the `Airtable` connection first. It is the most common point of failure. Ensure the `Base ID` is correct and the Token has `data.records:read` and `data.records:write` scopes.
- **Build Failures**: Run `npm run lint` locally to catch TypeScript errors before pushing.

## 8. Disaster Recovery — RPO / RTO

Defines recovery targets for the Sophia AI Factory production stack.

### Recovery Objectives

| Objective | Target | Measure |
|-----------|-------:|---------|
| **RPO** (Recovery Point Objective) | **24 hours** | Daily D1 snapshot uploaded to R2 `sophia-backups` bucket |
| **RTO** (Recovery Time Objective) | **4 hours** | Time from incident declaration to fully restored prod |
| Backup verification | Monthly | Operator runs SOP 11 dry-run restore on staging D1 |
| DR drill | Quarterly | End-to-end disaster recovery exercise |

### Backup Coverage

1. **D1 database** — `wrangler d1 export --remote` snapshot of `sophia-raas-db` (binding `DB`).
   - Trigger: external cron (Upstash QStash) calling `/api/cron/d1-backup` (Phase 4 G1 pending)
   - Storage: R2 bucket `sophia-backups`, key `d1/YYYY-MM-DD.sql.gz`
2. **R2 buckets** — `opennext-cache` is regenerable; `sophia-videos` is user content (rely on CF cross-region replication).
3. **Source code** — GitHub `longtho638-jpg/sophia-ai-factory` (with local mirror clones).
4. **Secrets** — Operator notebook (encrypted) holds `wrangler secret list` export.

### Recovery Procedure (High Level)

1. Declare incident; pin oncall in operator channel.
2. Identify last good backup in R2 `sophia-backups`.
3. Provision restore target (new D1 database or wipe `sophia-raas-db`).
4. Run `bash scripts/dr/restore-from-snapshot.sh <snapshot-key>` — see SOP 11 for full steps.
5. Verify with smoke test: `bash scripts/sop-ceo-production-smoke.sh`.
6. Re-deploy via `npm run deploy:full`, confirm SHA match.
7. Post-incident: file root-cause review and update DR drill checklist.

For step-by-step operator playbook: **SOP 11 — Emergency D1 Backup** in `dev-sops.md`.

### Known Gaps

- D1 backup automation pending Phase 4 (G1) — until then, manual trigger via SOP 11 required.
- DR drill cadence not yet scheduled; first drill due 30 days after Phase 4 ship.

## 9. Email DNS — SPF / DKIM / DMARC

Required DNS records for Resend transactional email deliverability on `sophia.agencyos.network`.

### Current Records (added 2026-05-12, Phase 2 G6)

| Type | Name | Content | Purpose |
|------|------|---------|---------|
| TXT | `sophia.agencyos.network` | `v=spf1 include:_spf.resend.com ~all` | SPF — softfail unauthorized senders |
| TXT | `_dmarc.sophia.agencyos.network` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@sophia.agencyos.network; pct=100; adkim=r; aspf=r` | DMARC — monitor mode (relaxed alignment) |
| TXT | `resend._domainkey.agencyos.network` | `p=MIGfM…` (Resend DKIM key on apex) | DKIM — signed via `d=agencyos.network`; covers sophia subdomain via organizational alignment |
| CAA | `sophia.agencyos.network` | `0 issue "letsencrypt.org"` | Restrict TLS cert issuance to Let's Encrypt only (Phase 1 G12) |

### Inherited from Parent Zone (`agencyos.network`)

- `_dmarc.agencyos.network` → `v=DMARC1; p=none;` (covers sibling subdomains)
- `resend._domainkey.agencyos.network` → DKIM public key (used when Resend signs with `d=agencyos.network`)

### Sender Addresses in Code

Confirmed senders in `src/`:
- `billing@sophia.agencyos.network` — billing/refund/bundle emails (`land/billing/email/`)
- `digest@sophia.agencyos.network` — weekly signals digest (`api/cron/weekly-signals-digest/`)
- `noreply@sophia.agencyos.network` — error digest, transactional default
- `noreply@mekongmind.com` — promo/trial expiry (legacy — separate domain auth)

### Verification

```bash
# Verify SPF
dig TXT sophia.agencyos.network +short | grep spf

# Verify DMARC
dig TXT _dmarc.sophia.agencyos.network +short

# Verify DKIM (apex)
dig TXT resend._domainkey.agencyos.network +short

# Mail-tester.com — send to inbox they provide; score should be ≥9/10
```

### Graduation Plan

| Phase | When | Action |
|-------|------|--------|
| Monitor (current) | Day 0 | `p=none` — collect DMARC reports for 14 days |
| Quarantine | Day 14 | Change `_dmarc.sophia` policy to `p=quarantine; pct=25` |
| Reject | Day 30 | Bump to `p=quarantine; pct=100` then `p=reject; pct=100` |

DMARC reports land in mailbox `dmarc-reports@sophia.agencyos.network` — operator MUST configure mailbox or discard route before tightening policy.

### Known Caveats

- Resend may need separate domain registration for `sophia.agencyos.network` subdomain in their dashboard if DKIM `d=` tag uses subdomain. Currently we rely on parent-domain DKIM alignment (organizational domain match). Verify in Resend dashboard if DMARC fails persist after 14d monitoring.
- `mekongmind.com` sender (promo/trial expiry) is on separate zone — needs independent SPF/DKIM/DMARC. Tracked separately.
