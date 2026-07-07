#!/bin/bash
# strip-ssr-bloat.sh — Remove client-only and heavy library code from SSR chunks
#
# MODES:
#   (default)               Both .next/ and .open-next/ strips (legacy, safe default)
#   --pre-build             Strip raw .next/server/chunks/ BEFORE OpenNext bundles them
#                           This reduces the final worker size at the source.
#   --post-opennext         Strip .open-next/ output after OpenNext build (legacy fallback)
#
# Run AFTER `next build`.
# For --pre-build: run BEFORE `@opennextjs/cloudflare build`.
# For --post-opennext: run AFTER `@opennextjs/cloudflare build`.

set -uo pipefail

PRE_BUILD=false
POST_OPENNEXT=false
if [[ "${1:-}" == "--pre-build" ]]; then
  PRE_BUILD=true
elif [[ "${1:-}" == "--post-opennext" ]]; then
  POST_OPENNEXT=true
fi

# Directories to strip.
# Pre-build strips .next/ source (effective); post-build strips .open-next/ bundle output.
if $PRE_BUILD; then
  CHUNKS_DIR=".next/server/chunks/ssr"
  STANDALONE_CHUNKS=".next/standalone/.next/server/chunks/ssr"
  NON_SSR_CHUNKS=".next/server/chunks"
  STANDALONE_NON_SSR=".next/standalone/.next/server/chunks"
  OPENNEXT_CHUNKS=""
  OPENNEXT_NON_SSR=""
elif $POST_OPENNEXT; then
  CHUNKS_DIR=".open-next/server-functions/default/.next/server/chunks/ssr"
  STANDALONE_CHUNKS=""
  NON_SSR_CHUNKS=".open-next/server-functions/default/.next/server/chunks"
  STANDALONE_NON_SSR=""
  OPENNEXT_CHUNKS=""
  OPENNEXT_NON_SSR=""
else
  # Default: strip both sources
  CHUNKS_DIR=".next/server/chunks/ssr"
  STANDALONE_CHUNKS=".next/standalone/.next/server/chunks/ssr"
  NON_SSR_CHUNKS=".next/server/chunks"
  STANDALONE_NON_SSR=".next/standalone/.next/server/chunks"
  OPENNEXT_CHUNKS=".open-next/server-functions/default/.next/server/chunks/ssr"
  OPENNEXT_NON_SSR=".open-next/server-functions/default/.next/server/chunks"
fi

strip_mode() {
  local pattern="$1"
  local label="$2"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    if [ -z "$dir" ] || [ ! -d "$dir" ]; then continue; fi
    for f in $(find "$dir" -name "$pattern" -type f ! -name "*.map" 2>/dev/null); do
      local size=$(wc -c < "$f")
      saved=$((saved + size))
      echo "module.exports=[];" > "$f"
    done
  done

  if [ $saved -gt 0 ]; then
    echo " Stripped $label: saved $(echo $saved | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

strip_sentry() {
  local label="sentry-sdk"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    if [ -z "$dir" ] || [ ! -d "$dir" ]; then continue; fi
    # Only target files >100KB with sentry in the name.
    # These are standalone sentry chunks Turbopack created as dedicated modules.
    # Smaller sentry chunks are part of the module graph — stripping them
    # breaks hashed module references (Cannot find module '@sentry/nextjs-xxxxx').
    for f in $(find "$dir" \( -name "*sentry*" -o -name "*SENTRY*" \) -type f ! -name "*.map" 2>/dev/null); do
      [ -f "$f" ] || continue
      # Skip interop shim files (contain __import_unsupported or CJS→ESM helpers)
      if grep -q "__import_unsupported\|__commonJS\|__esm\|__defProp" "$f" 2>/dev/null; then
        echo "  [skip interop] $f"
        continue
      fi
      local size=$(wc -c < "$f")
      if [ "$size" -gt 100000 ]; then
        saved=$((saved + size))
        echo "module.exports=[];" > "$f"
      fi
    done
  done

  if [ $saved -gt 0 ]; then
    echo " Stripped $label: saved $(echo $saved | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

# ── Header ──────────────────────────────────────────────────────────────
if $PRE_BUILD; then
  echo "=== Pre-build strip: raw .next/server/chunks/ → before OpenNext bundles ==="
elif $POST_OPENNEXT; then
  echo "=== Post-build strip: .open-next/ output (mitigation only) ==="
else
  echo "=== Strip: both .next/ and .open-next/ ==="
fi

# ── Client-only libraries (leak into SSR via Turbopack) ──────────────────
strip_mode "*html2canvas*"   "html2canvas"
strip_mode "*recharts*"      "recharts"
strip_mode "*jszip*"         "jszip"
strip_mode "*framer*motion*" "framer-motion"
strip_mode "*d3-*"           "d3 (recharts dep)"

# ── Heavy server-side libraries (strippable — alternate code paths exist) ──
strip_mode "*telegraf*"      "telegraf (Telegram bot)"
strip_mode "*stripe*"        "stripe (payments)"
strip_mode "*resend*"        "resend (email)"
strip_mode "*redis*"         "redis (cache client)"
strip_mode "*ioredis*"       "ioredis (cache client)"
strip_mode "*graphql*"       "graphql (client library)"
strip_mode "*kysely*"        "kysely (DB abstraction - direct D1)"
strip_mode "*better-sqlite3*" "better-sqlite3 (not used on CF)"
strip_mode "*@upstash/redis*" "@upstash/redis (alt redis client)"
strip_mode "*inngest*"       "inngest (job orchestrator - separate fn)"
strip_mode "*posthog-js*"    "posthog-js (analytics client)"

# ── Sentry SDK (OPTIONAL per no-tech doctrine) ──────────────────────────
# Per CLAUDE.md + sophia-no-tech-doctrine.md: "Source map upload requires
# SENTRY_AUTH_TOKEN at deploy time — OPTIONAL. Without it, errors are still
# captured; trace lines are minified."
# This is the primary bloater (~2.6 MB in 2 chunks of ~1.3 MB each).
strip_sentry

echo "Done."
