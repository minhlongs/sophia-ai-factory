#!/usr/bin/env bash
# Sophia AI Factory — one-shot Sentry + Slack alerts setup for non-tech founder.
#
# Prompts for 6 credentials, pushes them to Cloudflare Workers as secrets,
# deploys, and fires a test event via @sentry/cli to verify the pipeline.
#
# Usage:
#   bash scripts/founder-setup-sentry.sh
#
# Prereqs (founder must complete BEFORE running this script):
#   1. Sentry account + project created at https://sentry.io
#      → Settings → Projects → sophia-ai-factory → Client Keys (DSN)
#      → Settings → Auth Tokens → Create token w/ scope `project:releases`
#   2. Slack app w/ Incoming Webhook (https://api.slack.com/apps)
#      → Webhooks → Add Webhook → pick #sophia-alerts channel → copy URL
#   3. wrangler CLI logged in:  npx wrangler whoami
#
# Full step-by-step runbook: docs/handover/sentry-alerts-setup-runbook-260512.md

set -euo pipefail

cd "$(dirname "$0")/.."

echo "============================================================"
echo " Sophia AI Factory — Sentry + Slack one-shot setup"
echo "============================================================"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "[ERROR] npx not found. Install Node.js 20+ first." >&2
  exit 1
fi

read -r -p "1/6  NEXT_PUBLIC_SENTRY_DSN (https://...@o...ingest.sentry.io/...): " PUBLIC_DSN
read -r -p "2/6  SENTRY_DSN (paste the SAME DSN as above): " SERVER_DSN
read -r -p "3/6  SENTRY_AUTH_TOKEN (sntrys_...): " AUTH_TOKEN
read -r -p "4/6  SENTRY_ORG slug [sophia-ai-factory]: " SENTRY_ORG
SENTRY_ORG="${SENTRY_ORG:-sophia-ai-factory}"
read -r -p "5/6  SENTRY_PROJECT slug [sophia-ai-factory]: " SENTRY_PROJECT
SENTRY_PROJECT="${SENTRY_PROJECT:-sophia-ai-factory}"
read -r -p "6/6  SLACK_OPS_WEBHOOK_URL (https://hooks.slack.com/services/...): " SLACK_URL

for v in PUBLIC_DSN SERVER_DSN AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT SLACK_URL; do
  if [ -z "${!v}" ]; then
    echo "[ERROR] $v is required" >&2
    exit 1
  fi
done

if [[ ! "$PUBLIC_DSN" =~ ^https://.+@.+\.ingest\.sentry\.io/.+$ ]]; then
  echo "[ERROR] DSN must look like https://<key>@<org>.ingest.sentry.io/<project>" >&2
  echo "        Got: $PUBLIC_DSN" >&2
  exit 1
fi
if [ "$PUBLIC_DSN" != "$SERVER_DSN" ]; then
  echo "[ERROR] NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN must be IDENTICAL (paste same value twice)." >&2
  exit 1
fi
if [[ ! "$SLACK_URL" =~ ^https://hooks\.slack\.com/services/ ]]; then
  echo "[WARN] Slack URL doesn't match expected pattern — continuing anyway."
fi

echo ""
echo "▶ Pushing 6 secrets to Cloudflare Workers (sophia-ai-factory)..."
echo ""

push_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | npx wrangler secret put "$name" --name sophia-ai-factory >/dev/null
  echo "  ✓ $name"
}

push_secret NEXT_PUBLIC_SENTRY_DSN "$PUBLIC_DSN"
push_secret SENTRY_DSN              "$SERVER_DSN"
push_secret SENTRY_AUTH_TOKEN       "$AUTH_TOKEN"
push_secret SENTRY_ORG              "$SENTRY_ORG"
push_secret SENTRY_PROJECT          "$SENTRY_PROJECT"
push_secret SLACK_OPS_WEBHOOK_URL   "$SLACK_URL"

echo ""
echo "▶ Deploying via wrangler (CF-direct doctrine)..."
echo ""

npm run deploy:full

echo ""
echo "▶ Verifying deploy SHA match..."
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -fsS https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4 || echo "")
echo "  local=$LOCAL_SHA  live=$LIVE_SHA"
if [ "$LOCAL_SHA" != "$LIVE_SHA" ]; then
  echo "[WARN] SHA mismatch — deploy may be stale. Continuing to test event anyway."
fi

echo ""
echo "▶ Firing test event via @sentry/cli (Option C)..."
echo ""

SENTRY_AUTH_TOKEN="$AUTH_TOKEN" \
SENTRY_ORG="$SENTRY_ORG" \
SENTRY_PROJECT="$SENTRY_PROJECT" \
npx -y @sentry/cli send-event \
  --message "FOUNDER SETUP TEST — verify pipeline $(date -u +%FT%TZ)" \
  --level warning \
  --tag "source:founder-setup" \
  --tag "env:production"

cat <<EOF

============================================================
 ✅ DONE. Now verify in dashboards:
   • Sentry  → https://sentry.io/organizations/$SENTRY_ORG/issues/
              You should see the "FOUNDER SETUP TEST" event within ~30s.
   • Slack   → check the channel you wired — alert should appear if
              an alert rule targets that webhook.

 If Sentry shows the event but Slack stays silent:
   → Configure an Alert Rule in Sentry:
     Alerts → Create Alert → Issues → "Send notification to Slack"
     and select the integration / webhook you registered.

 Full runbook: docs/handover/sentry-alerts-setup-runbook-260512.md
============================================================
EOF
