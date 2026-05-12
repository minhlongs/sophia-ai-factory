# Sentry + Slack/Telegram Alerts Setup Runbook
**Sophia AI Factory** — Founder Setup Guide
**Document Date:** 2026-05-12  
**Estimated Time:** 25–30 minutes

---

## TL;DR

Sophia's error monitoring is **already wired**. This runbook walks you through 5 operational steps:

1. **Create Sentry project** at sentry.io → get DSN + Auth Token
2. **Register Slack webhook** at api.slack.com → invite bot to channel
3. **Set environment secrets** via `wrangler secret put` (4 commands)
4. **Deploy** via `npm run deploy:full` (~3 min)
5. **Test** by forcing an error → verify Sentry + Slack alerts fire

No code changes. Just secrets + deploy.

---

## What's Already Wired

**Sentry Integration** (source files):
- **Client config:** `sentry.client.config.ts` — browser session replays, client errors (2% sample in prod)
- **Server config:** `sentry.server.config.ts` — server-side errors (5% sample in prod)
- **Edge config:** `sentry.edge.config.ts` — Cloudflare Worker edge errors (5% sample in prod)
- **Shared options:** `src/lib/observability/sentry-options.ts` — DSN resolution, PII stripping, breadcrumb filtering
- **HTTP forwarder:** `src/lib/observability/sentry-forwarder.ts` — fire-and-forget JSON POST to Sentry (for cases where SDK unavailable)

**Slack Alerts** (source files):
- **Alert function:** `src/lib/monitoring/slack-alert.ts` — Posts structured emoji + context to webhook URL
- **Usage:** Circuit breaker (HeyGen failures) + smoke tests trigger Slack alerts automatically
- **Fallback:** If Slack webhook unavailable, logs to app logger (Inngest + structured logs pick it up)

**Dependencies installed:**
- `@sentry/nextjs`: ^10.51.0 ✅
- `telegraf`: ^4.16.3 ✅ (for Telegram bot integration, already wired)

**Environment variables expected:**
```
NEXT_PUBLIC_SENTRY_DSN          # Browser + public (rate-limited by Sentry)
SENTRY_DSN                      # Server/edge runtime
SENTRY_AUTH_TOKEN              # sentry-cli (source map uploads)
SENTRY_ORG                      # org slug (default: sophia-ai-factory)
SENTRY_PROJECT                  # project slug (default: sophia-ai-factory)
SLACK_OPS_WEBHOOK_URL          # Incoming Webhook from Slack workspace
```

Current status: All 6 env vars **unset** (require founder action).

---

## Step 1: Create Sentry Project (5 min)

### 1a. Sign up at sentry.io
1. Go to https://sentry.io/signup/
2. Create account with your founder email
3. Confirm email, log in to dashboard

### 1b. Create Organization
1. Click **Create Organization**
2. Name it: `sophia-ai-factory` (or `Sophia` for short)
3. Click **Create Organization**

### 1c. Create Project
1. Go to **Projects** tab
2. Click **Create Project**
3. **Platform:** Select **Next.js**
4. **Project Name:** `sophia-ai-factory`
5. **Alerts:** Leave defaults (we configure separately)
6. Click **Create Project**
7. Sentry will show you onboarding code — **ignore it** (we already have it)

### 1d. Get Your Credentials
After project creation, you'll see the dashboard. Go to **Settings** (⚙️ icon, bottom-left):

1. **Settings → Projects → sophia-ai-factory**
2. Copy **Client Key (DSN)** — looks like:
   ```
   https://abc123def456@o789012.ingest.sentry.io/345678
   ```
   This is your **`NEXT_PUBLIC_SENTRY_DSN`**

3. Go **Settings → Auth Tokens**
4. Click **Create Token**
5. Name: `sentry-cli-upload`
6. **Scopes:** Check `project:releases` only (least privilege)
7. Copy the token — this is your **`SENTRY_AUTH_TOKEN`**

8. Go **Settings → General**
9. Note your org slug (usually lowercase of org name) — this is **`SENTRY_ORG`**
10. Note project name slug — this is **`SENTRY_PROJECT`**

**Write these down:**
```
NEXT_PUBLIC_SENTRY_DSN = https://abc123def456@o789012.ingest.sentry.io/345678
SENTRY_DSN = https://abc123def456@o789012.ingest.sentry.io/345678
SENTRY_AUTH_TOKEN = sntrys_abc123...
SENTRY_ORG = sophia-ai-factory
SENTRY_PROJECT = sophia-ai-factory
```

---

## Step 2: Register Slack Webhook (5 min)

### 2a. Create Slack App
1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Select **From scratch**
4. **App Name:** `Sophia Alerts`
5. **Workspace:** Select your workspace (must be Slack workspace owner or admin)
6. Click **Create App**

### 2b. Enable Incoming Webhooks
1. Left sidebar: **Incoming Webhooks**
2. Toggle **ON** (blue)
3. Click **Add New Webhook to Workspace**
4. **Select channel:** Create a new channel first:
   - Go to your Slack workspace
   - Click **+** next to "Channels"
   - Create `#sophia-alerts` (or `#ops`, your choice)
5. Back to Slack App page, select the channel
6. Click **Allow** (authorization popup)
7. Copy the **Webhook URL** — looks like:
   ```
   https://hooks.slack.com/services/T123/B456/abc123def456xyz789
   ```
   This is your **`SLACK_OPS_WEBHOOK_URL`**

**Write this down:**
```
SLACK_OPS_WEBHOOK_URL = https://hooks.slack.com/services/T123/B456/abc123def456xyz789
```

---

## Step 3: Deploy Secrets to Cloudflare (5 min)

### 3a. Open Terminal
```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
```

### 3b. Set Sentry Secrets
Run these 4 commands (copy-paste from below, replace `<value>` with your actual values):

```bash
# 1. NEXT_PUBLIC_SENTRY_DSN (goes to browser, public)
echo "https://abc123def456@o789012.ingest.sentry.io/345678" | npx wrangler secret put NEXT_PUBLIC_SENTRY_DSN

# 2. SENTRY_DSN (server/edge only)
echo "https://abc123def456@o789012.ingest.sentry.io/345678" | npx wrangler secret put SENTRY_DSN

# 3. SENTRY_AUTH_TOKEN (for CLI source map uploads)
echo "sntrys_abc123def456..." | npx wrangler secret put SENTRY_AUTH_TOKEN

# 4. Sentry organization + project slugs
echo "sophia-ai-factory" | npx wrangler secret put SENTRY_ORG
echo "sophia-ai-factory" | npx wrangler secret put SENTRY_PROJECT
```

### 3c. Set Slack Secret
```bash
# 5. SLACK_OPS_WEBHOOK_URL
echo "https://hooks.slack.com/services/T123/B456/abc123def456xyz789" | npx wrangler secret put SLACK_OPS_WEBHOOK_URL
```

**Expected output:** Each command prints:
```
✓ Uploaded variable <NAME> to Cloudflare Workers
```

**If you see an error:**
- `wrangler not found` → run `npm install -g wrangler`
- `unauthorized` → run `npx wrangler login` first
- `rate limited` → wait 30 sec, retry

### 3d. Verify Secrets Were Stored
```bash
npx wrangler secret list
```

You should see all 6 secrets in the list. ✅

---

## Step 4: Deploy (3 min)

### 4a. Build + Deploy
```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory
npm run deploy:full
```

Wait for output ending with:
```
✓ Deployed sophia-ai-factory (XXX ms)
```

### 4b. Verify Deploy SHA Matches
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOY OK" || echo "❌ STALE — re-run deploy:full"
```

If you see `✅ DEPLOY OK`, continue to Step 5. ✅

---

## Step 5: Test Error Capture (5 min)

### 5a. Force a Test Error
We'll create a temporary test error to verify Sentry + Slack integration. **Option A:** If you're comfortable with code, add this test route:

**File:** `src/app/api/_debug/throw/route.ts`
```typescript
export async function GET() {
  throw new Error('Test error from founder setup — can delete after verification');
}
```

Then hit: `https://sophia.agencyos.network/api/_debug/throw`

**Option B (safer):** Trigger error via existing smoke test:
```bash
# This runs the smoke test which intentionally triggers a Slack alert
npm run test:smoke
```

**Option C (recommended — zero code, fastest):** Use Sentry CLI's `send-event` to ship a synthetic event directly to Sentry from your laptop:
```bash
cd apps/sophia-ai-factory
export SENTRY_DSN="<paste DSN from Step 1>"
export SENTRY_AUTH_TOKEN="<paste Auth Token from Step 1>"
export SENTRY_ORG="sophia-ai-factory"
export SENTRY_PROJECT="sophia-ai-factory"
npx @sentry/cli send-event --message "FOUNDER SETUP TEST — verify pipeline $(date -u +%FT%TZ)" --level warning --tag "source:founder-setup"
```
- ✅ No code change, no deploy needed
- ✅ Event reaches Sentry within 5 seconds
- ✅ Works even if Worker secrets aren't deployed yet (uses local env)
- ⚠️ Won't trigger Slack alert unless Sentry → Slack integration is wired (Step 2c). To force Slack alert end-to-end, use Option A or B.

Wait 10 seconds.

### 5b. Verify Sentry Captured the Error
1. Go to https://sentry.io
2. Log in
3. Navigate to **Projects → sophia-ai-factory**
4. Look for **Latest Events** panel
5. You should see 1–2 events (the test error)
6. Click to expand — verify it shows:
   - Error message
   - Stack trace
   - Browser/runtime context
   - ✅ Release version matching `git rev-parse HEAD | cut -c1-8`

### 5c. Verify Slack Alert Fired
1. Go to your Slack workspace
2. Navigate to **#sophia-alerts** channel
3. Look for a **red circle 🔴 [HIGH]** message
4. Message should show the error message + context

If you see both Sentry event + Slack message, **you're done!** ✅

---

## Troubleshooting

### Sentry shows no events after 30 seconds
- **Check 1:** Is `NEXT_PUBLIC_SENTRY_DSN` set? (Run `npx wrangler secret list`)
- **Check 2:** Is Sentry project public (not archived)? Go to sentry.io → Settings → Project Status
- **Check 3:** Did you restart after setting secrets? (Secrets apply on next deploy, not immediately)
  - Solution: Re-run `npm run deploy:full`

### Slack webhook returns 404
- **Check 1:** Did you copy the full URL (including `https://`)? Paste it carefully.
- **Check 2:** Did you test webhook in Slack? Go to api.slack.com → Your App → Incoming Webhooks → Click **Test** button next to your webhook
- **Check 3:** Is the webhook URL still valid? (Slack sometimes regenerates them) → Create a new one if unsure

### "wrangler secret put" returns "unauthorized"
- **Solution:** Run `npx wrangler login` first, then retry the secret commands

### Build fails with "SENTRY_AUTH_TOKEN not found"
- This happens if you skip secret setup. Just complete Step 3, then re-run `npm run deploy:full`

---

## Source Map Upload (Optional but Recommended)

Sentry needs source maps to show readable stack traces. This is **automatic** in our build, but you can verify:

```bash
# After deploy:full completes:
npx @sentry/cli releases list

# Should show your deploy SHA with source maps uploaded
```

If source maps don't show:
```bash
# Manual upload (rarely needed)
npx @sentry/cli releases files <COMMIT_SHA> upload-sourcemaps .next/standalone/.next/static
```

---

## Slack + Sentry Integration (Future: Webhook → Alerts)

**Current state:** Alerts are **manual** (circuit breaker + smoke tests call Slack directly).

**Future enhancement (Phase 02):** Wire Sentry → Slack via Sentry webhook:
1. Go to Sentry → Settings → Integrations
2. Search "Slack"
3. Install official Slack integration
4. Connect to workspace
5. Configure alert rules (e.g., "Post to #sophia-alerts when error rate > 5%")

This is **not required** for founder setup (manual alerts work fine for MVP).

---

## Telegram Alerts (Optional)

Sophia also supports **Telegram notifications** (via @Sophia_Bbot). This is **already wired** in code but uses separate env vars:

```
TELEGRAM_BOT_TOKEN       # Bot token from BotFather
TELEGRAM_ADMIN_CHAT_ID   # Your private chat ID (get via @userinfobot)
```

**To enable:**
1. Get bot token from @BotFather on Telegram
2. Get your chat ID: message @userinfobot, copy the `id` field
3. Set secrets:
   ```bash
   echo "<TOKEN>" | npx wrangler secret put TELEGRAM_BOT_TOKEN
   echo "<CHAT_ID>" | npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
   ```
4. Re-deploy: `npm run deploy:full`

**Alerts triggered:** Payout notifications, admin errors (auto-forwarded from app logger).

---

## Validation Checklist (Copy-Paste Into Your Ticket)

After completing all steps, copy-paste this checklist and verify each line:

```
✓ Step 1: Sentry project created at sentry.io
  ├─ NEXT_PUBLIC_SENTRY_DSN set
  ├─ SENTRY_DSN set
  ├─ SENTRY_AUTH_TOKEN set
  ├─ SENTRY_ORG set to sophia-ai-factory
  └─ SENTRY_PROJECT set to sophia-ai-factory

✓ Step 2: Slack Incoming Webhook registered
  ├─ Slack app "Sophia Alerts" created
  ├─ Webhook URL obtained
  └─ SLACK_OPS_WEBHOOK_URL set

✓ Step 3: All 6 secrets deployed via wrangler
  └─ npx wrangler secret list shows all 6 vars

✓ Step 4: Deploy completed
  └─ SHA match verified (Local: XXXX  Live: XXXX)

✓ Step 5: Test error triggered
  ├─ Sentry shows event in dashboard
  ├─ Slack shows alert in #sophia-alerts
  └─ Both have matching timestamps (within 1 min)

Status: ✅ SENTRY + ALERTS LIVE
Verified by: [your name]
Date: [date]
```

---

## Commands Reference (Quick Copy-Paste)

**Complete setup in one block** (if all values ready):
```bash
cd ~/projects/sophia-ai-factory/apps/sophia-ai-factory

# Replace <values> with your actual secrets
echo "<NEXT_PUBLIC_SENTRY_DSN>" | npx wrangler secret put NEXT_PUBLIC_SENTRY_DSN
echo "<SENTRY_DSN>" | npx wrangler secret put SENTRY_DSN
echo "<SENTRY_AUTH_TOKEN>" | npx wrangler secret put SENTRY_AUTH_TOKEN
echo "sophia-ai-factory" | npx wrangler secret put SENTRY_ORG
echo "sophia-ai-factory" | npx wrangler secret put SENTRY_PROJECT
echo "<SLACK_OPS_WEBHOOK_URL>" | npx wrangler secret put SLACK_OPS_WEBHOOK_URL

# Deploy
npm run deploy:full

# Verify
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Deploy verified: Local=$LOCAL_SHA Live=$LIVE_SHA"
```

---

## Next Steps

1. **Production monitoring:** Set up Sentry alerts rules (email threshold, Slack auto-route by severity)
2. **Telegram (optional):** Add payout notifications to your personal Telegram
3. **Dashboard:** Bookmark https://sentry.io/organizations/sophia-ai-factory/issues/ for daily error review
4. **On-call:** Designate who monitors #sophia-alerts during business hours

---

## Support

- **Sentry docs:** https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Slack webhooks:** https://api.slack.com/messaging/webhooks
- **Our codebase:**
  - Sentry configs: `sentry.*.config.ts` (3 files)
  - Sentry options: `src/lib/observability/sentry-options.ts`
  - Slack alert: `src/lib/monitoring/slack-alert.ts`

---

**Questions? Check Slack #sophia-alerts or email support@sophia.agencyos.network**
