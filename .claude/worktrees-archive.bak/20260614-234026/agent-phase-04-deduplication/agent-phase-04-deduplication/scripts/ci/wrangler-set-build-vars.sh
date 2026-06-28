#!/usr/bin/env bash
# wrangler-set-build-vars.sh — RED-TEAM #1
# Atomically injects build metadata as CF Secrets (NOT sed file rewrites).
# Called in test.yml deploy job before Migration guard + Deploy step.
# (Originally lived in gate-5/deploy.yml; restored to test.yml in eb475f2.)
# Requires: CLOUDFLARE_API_TOKEN env var set (via GH Secrets).
set -euo pipefail

COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
DEPLOYED_AT="$(date -u +%FT%TZ)"
BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"

echo "[vars] Injecting build metadata as Cloudflare Secrets..."
echo "[vars] SHA: ${COMMIT_SHA:0:8}... | Branch: $BRANCH | At: $DEPLOYED_AT"

# Atomic secret injection — no file writes, no diff noise, scoped to Worker
echo "$COMMIT_SHA"   | npx wrangler secret put COMMIT_SHA   --name sophia-ai-factory
echo "$DEPLOYED_AT"  | npx wrangler secret put DEPLOYED_AT  --name sophia-ai-factory
echo "$BRANCH"       | npx wrangler secret put DEPLOY_BRANCH --name sophia-ai-factory

echo "[vars] Build metadata injected successfully."
