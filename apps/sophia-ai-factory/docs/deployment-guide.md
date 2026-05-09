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

2. **Cloudflare Secrets Set** (13 required — 2 new for Wave 12)
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
   ```
   
   **New Video Webhook Secrets (2026-04-29)**:
   - `HEYGEN_WEBHOOK_SECRET` — HeyGen webhook signature verification (HMAC-SHA256).
   - `HEYGEN_API_KEY` — HeyGen API credential for video polling.
   
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

Sophia AI Factory deploys to **Cloudflare Workers** (not Vercel). GitHub Actions automatically builds, tests, and deploys on `git push origin main`.

### Step 1: Push to GitHub
Ensure your code is committed and pushed to `origin main`.

### Step 2: GitHub Actions (Automatic)
The workflow **Tests & Deploy** runs automatically:
1. **Lint & Build & Test** job: Verifies code quality
2. **Deploy to Cloudflare Workers** job: Builds OpenNext worker + applies D1 migrations + deploys

### Step 3: Verify Deployment
```bash
# Check CI/CD status
gh run list --repo longtho638-jpg/sophia-ai-factory -L 1

# Verify production health
curl -s https://sophia.agencyos.network/api/version
# Should output: { shortSha: "abc12345", deployedAt: "...", opennextVersion: "..." }

# Verify commit SHA matches
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
```

### Step 4: Configure Secrets & D1 Migrations
After first deploy, follow **Sprint M Revenue Path Deployment Requirements** section above to:
1. Apply D1 migrations
2. Set Cloudflare Secrets
3. Configure ClickBank vendor INS URL

### Step 5: Production Setup Wizard (CLI)

After deploying, run the interactive production setup wizard to verify connections and configure third-party services (NOWPayments, Telegram, Supabase).

```bash
# Run locally against your production environment credentials
npm run setup:production
```

This wizard will:
1. **Verify Environment Variables**: Checks for missing keys.
2. **Supabase**: Tests connection and verifies required tables exist.
3. **NOWPayments**: Verifies API key access and IPN webhook configuration.
4. **Telegram**: Verifies Bot Token and configures the Webhook URL.
5. **Report**: Generates a `production-setup-report.md` with the status of your system.

## 3. Automation Setup (n8n)

The "Brain" of the factory runs on n8n. You need to connect your local/deployed app to an n8n instance.

### Option A: n8n Cloud (Recommended)
1. Sign up for n8n Cloud.
2. Import the workflows from the `workflows/` directory in this project.
3. Activate the workflows.
4. Copy the **Production Webhook URLs**.
5. Add these URLs to your Sophia Factory configuration (via Wizard or .env).

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
