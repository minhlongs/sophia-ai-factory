#!/usr/bin/env bash
# Upload source maps to Sentry after build.
# Usage: SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... bash scripts/ci/sentry-upload-sourcemaps.sh
# Gracefully skips if SENTRY_AUTH_TOKEN is absent — never blocks deploy.
set -euo pipefail

# Skip gracefully when auth token not set (e.g., local dev without Sentry configured)
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "warn: SENTRY_AUTH_TOKEN not set — skipping Sentry source map upload"
  exit 0
fi

# Require org + project
: "${SENTRY_ORG:?SENTRY_ORG must be set}"
: "${SENTRY_PROJECT:?SENTRY_PROJECT must be set}"

# Release = short commit SHA (matches /api/version shortSha)
RELEASE="${SENTRY_RELEASE:-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')}"

echo "Sentry: releasing $RELEASE for $SENTRY_ORG/$SENTRY_PROJECT"

# Create release
npx @sentry/cli releases new "$RELEASE" --org "$SENTRY_ORG" --project "$SENTRY_PROJECT" || { echo "warn: releases new failed (non-fatal)"; exit 0; }

# Upload Next.js client + server source maps
if [ -d ".next" ]; then
  npx @sentry/cli sourcemaps upload \
    --release "$RELEASE" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" \
    .next/ || echo "warn: .next/ map upload failed (non-fatal)"
fi

# Upload OpenNext worker source maps (server bundle)
if [ -d ".open-next" ]; then
  npx @sentry/cli sourcemaps upload \
    --release "$RELEASE" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" \
    .open-next/ || echo "warn: .open-next/ map upload failed (non-fatal)"
fi

# Link to git commits (needs full history — ensure fetch-depth: 0 in CI)
npx @sentry/cli releases set-commits "$RELEASE" \
  --org "$SENTRY_ORG" \
  --auto || echo "warn: set-commits failed (non-fatal)"

# Finalize release
npx @sentry/cli releases finalize "$RELEASE" \
  --org "$SENTRY_ORG" || echo "warn: finalize failed (non-fatal)"

echo "Sentry: release $RELEASE finalized"
