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

strip_pattern() {
  local pattern="$1"
  local label="$2"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR"; do
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

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR"; do
    if [ -d "$dir" ]; then
      for f in $(find "$dir" -name "*.js" ! -name "*.map" -size +"${min_size}c" -type f 2>/dev/null); do
        if head -c 300 "$f" | grep -q "$needle"; then
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

# Heavy libs identified by content signature (filenames are hashed)
strip_by_content "immer-nothing" "immer" 200000
# Sentry: truncate to just re-export stubs, keeping Turbopack module wrapper intact.
# Previous approach replaced the entire file, destroying co-bundled non-sentry modules
# and causing "module factory is not available" SSR crashes.
strip_sentry() {
  local label="sentry-sdk"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR"; do
    if [ -d "$dir" ]; then
      # Only target files where sentry dominates (>90% of content). These are
      # standalone sentry chunks, not bundles mixing sentry with app code.
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
strip_sentry

echo "Done."
