#!/bin/bash
# strip-ssr-bloat.sh — Remove client-only library code from SSR chunks
# Run AFTER `next build` but BEFORE `@opennextjs/cloudflare build`
# These libraries are only needed for client-side rendering; their SSR chunks
# contain the full library code but are never executed on the server.

set -uo pipefail

CHUNKS_DIR=".next/server/chunks/ssr"
STANDALONE_CHUNKS=".next/standalone/.next/server/chunks/ssr"
NON_SSR_CHUNKS=".next/server/chunks"
STANDALONE_NON_SSR=".next/standalone/.next/server/chunks"
OPENNEXT_CHUNKS=".open-next/server-functions/default/.next/server/chunks/ssr"
OPENNEXT_NON_SSR=".open-next/server-functions/default/.next/server/chunks"

strip_pattern() {
  local pattern="$1"
  local label="$2"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    if [ -d "$dir" ]; then
      for f in $(find "$dir" -name "$pattern" -type f ! -name "*.map" 2>/dev/null); do
        local size=$(wc -c < "$f")
        saved=$((saved + size))
        echo "module.exports=[];" > "$f"
      done
    fi
  done

  if [ $saved -gt 0 ]; then
    echo "  Stripped $label: saved $(echo $saved | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

strip_by_content() {
  local needle="$1"
  local label="$2"
  local min_size="${3:-100000}"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    if [ -d "$dir" ]; then
      for f in $(find "$dir" -name "*.js" ! -name "*.map" -size +"${min_size}c" -type f 2>/dev/null); do
        if grep -q "$needle" "$f"; then
          local size=$(wc -c < "$f")
          saved=$((saved + size))
          echo "module.exports=[];" > "$f"
        fi
      done
    fi
  done

  if [ $saved -gt 0 ]; then
    echo "  Stripped $label: saved $(echo $saved | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

echo "Stripping client-only and heavy SSR chunks..."

# Client-only libraries that leak into SSR via Turbopack
strip_pattern "*html2canvas*" "html2canvas"
strip_pattern "*recharts*" "recharts"
strip_pattern "*jszip*" "jszip"
strip_pattern "*framer*motion*" "framer-motion"
strip_pattern "*d3-*" "d3 (recharts dep)"

# Heavy server-side libraries that can be stubbed for size reduction
# These are only needed for specific routes; their full code bloats the default function
strip_pattern "*telegraf*" "telegraf (Telegram bot)"
strip_pattern "*stripe*" "stripe (payments)"
strip_pattern "*resend*" "resend (email)"
strip_pattern "*redis*" "redis (cache client)"
strip_pattern "*ioredis*" "ioredis (cache client)"
strip_pattern "*graphql*" "graphql (client library)"
strip_pattern "*kysely*" "kysely (DB abstraction - using direct D1)"
strip_pattern "*better-sqlite3*" "better-sqlite3 (not used on Cloudflare)"
strip_pattern "*@upstash/redis*" "@upstash/redis (alternative redis client)"
strip_pattern "*inngest*" "inngest (job orchestrator - uses separate functions)"
strip_pattern "*posthog-js*" "posthog-js (analytics client)"

# Heavy libs identified by content signature (filenames are hashed)
# strip_by_content "immer-nothing" "immer" 200000
# strip_by_content "SentryHttpInstrumentation" "sentry-sdk-heavy" 100000
# strip_by_content "wrapMcpServerWithSentry" "sentry-sdk-core" 100000
# Sentry: truncate to just re-export stubs, keeping Turbopack module wrapper intact.
# Previous approach replaced the entire file, destroying co-bundled non-sentry modules
# and causing "module factory is not available" SSR crashes.
# IMPORTANT: Only strip sentry files that are LARGE (>100KB). Smaller sentry chunks
# are part of the module graph and must NOT be stripped or the hashed module references
# will break (Cannot find module '@sentry/nextjs-xxxxx').
strip_sentry() {
  local label="sentry-sdk"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    if [ -d "$dir" ]; then
      # Only target files where sentry dominates size-wise (>100KB).
      # These are standalone sentry chunks, not bundles mixing sentry with app code.
      for f in $(find "$dir" -name "*sentry*" -o -name "*SENTRY*" -type f ! -name "*.map" 2>/dev/null); do
        [ -f "$f" ] || continue
        local size=$(wc -c < "$f")
        if [ "$size" -gt 100000 ]; then
          saved=$((saved + size))
          echo "module.exports=[];" > "$f"
        fi
      done
    fi
  done

  if [ $saved -gt 0 ]; then
    echo "  Stripped $label: saved $(echo $saved | awk '{printf "%.0f KB", $1/1024}')"
  fi
}
# strip_sentry

echo "Done."
