#!/usr/bin/env bash
# strip-ssr-bloat.sh — Remove client-only / heavy library code from SSR chunks
# and OpenNext inlined node_modules to reduce CF Worker bundle size.
#
# MODES:
#   (default)   Strip both .next/ and .open-next/ SSR chunks
#   --pre-build Strip .next/server/chunks/ BEFORE OpenNext bundles
#   --post-opennext  Strip .open-next/ AFTER OpenNext build
#   --opennext-node-modules  Strip OpenNext inlined node_modules

set -uo pipefail

PRE_BUILD=false
POST_OPENNEXT=false
STRIP_NODE_MODULES=false

if [[ "${1:-}" == "--pre-build" ]]; then
  PRE_BUILD=true
elif [[ "${1:-}" == "--post-opennext" ]]; then
  POST_OPENNEXT=true
elif [[ "${1:-}" == "--opennext-node-modules" ]]; then
  STRIP_NODE_MODULES=true
fi

if $PRE_BUILD; then
  # node_modules_* are in chunks/ directly (NOT in ssr/) after Turbopack
  CHUNKS_DIR=""
  STANDALONE_CHUNKS=""
  NON_SSR_CHUNKS=".next/server/chunks"
  STANDALONE_NON_SSR=".next/standalone/.next/server/chunks"
  OPENNEXT_CHUNKS=""
  OPENNEXT_NON_SSR=""
elif $POST_OPENNEXT; then
  CHUNKS_DIR=".open-next/server-functions/default/.next/server/chunks/ssr"
  STANDALONE_CHUNKS=""
  NON_SSR_CHUNKS=".open-next/server-functions/default/.next/server/chunks"
  STANDALONE_NON_SSR=".open-next/server-functions/default/.next/server/chunks"
  OPENNEXT_CHUNKS=""
  OPENNEXT_NON_SSR=""
elif $STRIP_NODE_MODULES; then
  CHUNKS_DIR=""
  STANDALONE_CHUNKS=""
  NON_SSR_CHUNKS=""
  STANDALONE_NON_SSR=""
  OPENNEXT_CHUNKS=""
  OPENNEXT_NON_SSR=""
else
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
    [[ -z "$dir" || ! -d "$dir" ]] && continue
    for f in $(find "$dir" -name "$pattern" -type f ! -name "*.map" 2>/dev/null); do
      local size
      size=$(wc -c < "$f")
      saved=$((saved + size))
      echo "module.exports=[];" > "$f"
    done
  done

  if [ "$saved" -gt 0 ]; then
    echo " Stripped $label: saved $(echo "$saved" | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

strip_sentry() {
  local label="sentry-sdk"
  local saved=0

  for dir in "$CHUNKS_DIR" "$STANDALONE_CHUNKS" "$NON_SSR_CHUNKS" "$STANDALONE_NON_SSR" "$OPENNEXT_CHUNKS" "$OPENNEXT_NON_SSR"; do
    [[ -z "$dir" || ! -d "$dir" ]] && continue
    for f in $(find "$dir" \( -name "*sentry*" -o -name "*SENTRY*" \) -type f ! -name "*.map" 2>/dev/null); do
      [[ -f "$f" ]] || continue
      if grep -q "__import_unsupported\|__commonJS\|__esm\|__defProp" "$f" 2>/dev/null; then
        continue
      fi
      local size
      size=$(wc -c < "$f")
      if [ "$size" -gt 100000 ]; then
        saved=$((saved + size))
        echo "module.exports=[];" > "$f"
      fi
    done
  done

  if [ "$saved" -gt 0 ]; then
    echo " Stripped $label: saved $(echo "$saved" | awk '{printf "%.0f KB", $1/1024}')"
  fi
}

strip_opennext_node_modules() {
  local nm_dir=".open-next/server-functions/default/node_modules"
  if [ ! -d "$nm_dir" ]; then
    echo " [skip] OpenNext node_modules not found at $nm_dir"
    return 0
  fi

  # Only strip packages that are: (1) client-only or unused on CF Workers
  # AND (2) confirmed harmless when replaced with [] by OpenNext esbuild.
  # DO NOT strip runtime domain packages like telegraf, stripe, inngest,
  # resend, redis, etc. — they are REQUIRED by server-side code paths.
  local pkg_names=(
    "html2canvas"
    "recharts"
    "@apm-js-collab"
    "d3-*"
    "framer-motion"
    "jszip"
    "@sentry/nextjs"
    "@sentry/browser"
    "pigeon-maps"
    "react-draggable"
    "react-colorful"
 "kysely"
 "@opentelemetry/*"
)

  local total_saved=0

  for pkg in "${pkg_names[@]}"; do
    local pkg_dir
    pkg_dir=$(find "$nm_dir" -maxdepth 1 -type d \( -name "$pkg" -o -name "${pkg%/}" \) 2>/dev/null | head -1)
    if [ -z "$pkg_dir" ] || [ ! -d "$pkg_dir" ]; then continue; fi

    # Calculate total size of JS/CJS/MJS files (depth ≤2, skip maps)
    local pkg_saved=0
    for f in $(find "$pkg_dir" -maxdepth 2 -type f \( -name "*.js" -o -name "*.cjs" -o -name "*.mjs" \) ! -name "*.map" 2>/dev/null); do
      local size
      size=$(wc -c < "$f")
      pkg_saved=$((pkg_saved + size))
      echo "module.exports=[];" > "$f"
    done

    if [ "$pkg_saved" -gt 0 ]; then
      echo " Stripped $pkg (node_modules): saved $(echo "$pkg_saved" | awk '{printf "%.0f KB", $1/1024}')"
      total_saved=$((total_saved + pkg_saved))
    fi
  done

  # Large standalone sentry files (>100KB) already handled in strip_sentry for chunks.
  # In node_modules, strip them directly (no interop concern — full detached copies).
  for f in $(find "$nm_dir" -maxdepth 2 -type f \( -name "*sentry*" -o -name "*SENTRY*" \) ! -name "*.map" 2>/dev/null); do
    [[ -f "$f" ]] || continue
    local size
    size=$(wc -c < "$f")
    if [ "$size" -gt 100000 ]; then
      total_saved=$((total_saved + size))
      echo "module.exports=[];" > "$f"
    fi
  done

  if [ "$total_saved" -gt 0 ]; then
    echo " Total node_modules stripped: $(echo "$total_saved" | awk '{printf "%.0f KB", $1/1024}')"
  # Purge SQL snapshot files accidentally bundled into OpenNext output
  sql_saved=0
  for f in $(find "$nm_dir" -maxdepth 1 -type f -name "*.sql" 2>/dev/null); do
    [[ -f "$f" ]] || continue
    sql_size=$(wc -c < "$f")
    sql_saved=$((sql_saved + sql_size))
    : > "$f"
  done
  if [ "$sql_saved" -gt 0 ]; then
    echo " Purged .sql files in node_modules: saved $(echo "$sql_saved" | awk '{printf "%.0f KB", $1/1024}')"
    total_saved=$((total_saved + sql_saved))
  fi
  fi
}

# ── Header ──────────────────────────────────────────────────────────────
if $PRE_BUILD; then
  echo "=== Pre-build strip: .next/server/chunks/ before OpenNext bundles ==="
elif $POST_OPENNEXT; then
  echo "=== Post-build strip: .open-next/ output ==="
elif $STRIP_NODE_MODULES; then
  echo "=== Strip: OpenNext inlined node_modules (client-only libs) ==="
else
  echo "=== Strip: both .next/ and .open-next/ SSR chunks ==="
fi


# ── OpenTelemetry SSR stubs (Turbopack lazy-parcel + webpack chunk names) ─
# Both naming conventions exist for OTel in Turbopack builds:
#   - 0_lp_modules_@opentelemetry_*  (Turbopack lazy-parcel, primary)
#   - node_modules_@opentelemetry_*    (webpack-style fallback)
#   - node_modules__opentelemetry_*    (double-underscore variant)
#   - node_modules_next_dist_compiled_@opentelemetry_* (next/dist compiled)
# These SSR chunks crash the Workers runtime -- instrumentation.ts short-circuits
# in Workers mode, but these embedded chunk files are NOT caught by that guard.
strip_mode "0_lp_modules_@opentelemetry*"  "OTel SSR (Turbopack lp)"
strip_mode "node_modules_@opentelemetry*"  "OTel SSR (webpack)"
strip_mode "node_modules__opentelemetry*"  "OTel SSR (double-_.)"
strip_mode "node_modules_next_dist_compiled_@opentelemetry*" "OTel SSR (next/dist)"

# ── Client-only libraries (leak into SSR via Turbopack) ──────────────────
# These are UI libraries that should never execute on the server.
strip_mode "*html2canvas*" "html2canvas"
strip_mode "*recharts*"   "recharts"
strip_mode "*jszip*"      "jszip"
strip_mode "*framer*motion*" "framer-motion"
strip_mode "*d3-*"        "d3 (recharts dep)"

# ── Sentry SDK ─────────────────────────────────────────────────────────
# Per no-tech doctrine, source map upload is OPTIONAL.
# This is the primary bloater (~2.6 MB in chunks >100 KB each).
strip_sentry

strip_top_level_builtins

# ── Safe server-incompatible stubs (used as null-op on CF Workers) ──────
# These reference packages that are replaced with stubs or never called
# on the server in the CF Workers runtime.
strip_mode "*better-sqlite3*"  "better-sqlite3 (not used on CF)"
strip_mode "*@upstash/redis*"  "@upstash/redis"
strip_mode "*uncrypto*"        "uncrypto"
strip_mode "*node-polyfill-crypto*" "Next.js node-polyfill-crypto (CRASH ROOT CAUSE)"
strip_mode "*node-environment-extensions/node-crypto*" "Next.js node-crypto (CRASH ROOT CAUSE v16)"
strip_mode "*firebase*"        "firebase"
strip_mode "*@prisma*"         "@prisma"
strip_mode "*prisma*"          "prisma"
strip_mode "@sentry/*"         "sentry wildcard"
strip_mode "*apm-js-collab*" "@apm-js-collab (uses node:fs, not Workers-compatible)"

# ── Next.js v16 top-level Node builtin imports (CRASH Workers at eval) ──
# These execute at MODULE EVALUATION TIME (before fetch()), not inside a function.
# strip_mode() above only strips chunk *.js files — it cannot touch handler.mjs.
# So we sed-delete these import lines from the bundled entry points directly.
strip_top_level_builtins() {
  local saved=0

  local handler=".open-next/server-functions/default/handler.mjs"
  if [[ -f "$handler" ]]; then
    local n
    n=$(grep -cE 'from "[^"]*node:(timers|util|fs|path|stream|events|url)[^"]*"' "$handler" 2>/dev/null || echo 0)
    if [[ "$n" -gt 0 ]]; then
      sed -i.bak -E '/from "[^"]*node:(timers|util|fs|path|stream|events|url)[^"]*"/d' "$handler"
      echo "  Stripped node:* top-level imports ($n) from handler.mjs"
    fi
  fi

  local mw=".open-next/middleware/handler.mjs"
  if [[ -f "$mw" ]]; then
    local n
    n=$(grep -cE 'from "[^"]*node:(buffer|async_hooks|util|fs)[^"]*"' "$mw" 2>/dev/null || echo 0)
    if [[ "$n" -gt 0 ]]; then
      sed -i.bak -E '/from "[^"]*node:(buffer|async_hooks|util|fs)[^"]*"/d' "$mw"
      echo "  Stripped node:* top-level imports ($n) from middleware/handler.mjs"
    fi
  fi
}
if $STRIP_NODE_MODULES; then
  strip_opennext_node_modules
fi

# ── NUCLEAR OPTION: sed-remove crypto polyfill bloat from handler.mjs ──────
# Turbopack inlines node-crypto.js + web-crypto.js directly into handler.mjs.
# These call require("node:crypto") which crashes Workers. They are wrapped
# in try/catch and SERVICES crypto via globalThis.crypto on Workers anyway.
# Replace the inlined modules with minimal stubs that NO-OP the patches.
HANDLER=".open-next/server-functions/default/handler.mjs"
if [[ -f "$HANDLER" ]]; then
  # Count how many times we find the crash pattern
  COUNT=$(grep -c 'require("node:crypto")' "$HANDLER" 2>/dev/null || echo 0)
  if [[ "$COUNT" -gt 0 ]]; then
    echo "Sed-patching $COUNT require(\"node:crypto\") calls in handler.mjs to no-ops..."

    # Strategy: replace the entire named IIFE body where node:crypto is required.
    # Pattern: var require_node_crypto=__commonJS({..."
    #          ...require("node:crypto")...
    #          ...});  (the closing })
    # We use perl for more powerful regex, fallback to python3

python3 -c "
with open('$HANDLER', 'r') as f:
    content = f.read()

STUB = 'var require_node_crypto=function(){return{getRandomValues:function(a){return globalThis.crypto.getRandomValues(a)},randomUUID:function(){return globalThis.crypto.randomUUID()},randomBytes:function(){return crypto.getRandomValues(new Uint8Array(arguments[0]||16))},subtle:globalThis.crypto.subtle}};require_node_crypto.default=require_node_crypto;require_node_crypto.exports=require_node_crypto.exports;require_node_crypto.async=require_node_crypto;export default require_node_crypto;'

def find_block_end(s, pos):
    depth = 0
    in_s = None
    i = pos
    while i < len(s):
        c = s[i]
        if in_s:
            if c == chr(92): i += 1
            elif c == in_s: in_s = None
        else:
            if c in chr(34)+chr(39)+chr(96): in_s = c
            elif c == chr(123): depth += 1
            elif c == chr(125):
                depth -= 1
                if depth == 0:
                    j = i + 1
                    while j < len(s) and s[j] in ' \t\n\r);': j += 1
                    return j
        i += 1
    return -1

n = 0
off = 0
nc = content
while True:
    idx = nc.find('var require_node_crypto=', off)
    if idx < 0: break
    j = nc.find('__commonJS({', idx)
    if j < 0 or j > idx + 30:
        off = idx + 1
        continue
    end = find_block_end(nc, j + len('__commonJS('))
    if end < 0: break
    block = nc[idx:end]
    if 'require(\"node:crypto\")' in block:
        nc = nc[:idx] + STUB + nc[end:]
        n += 1
        off = idx + len(STUB)
    else:
        off = end

rem = nc.count('require(\"node:crypto\")')
print('  Matched {} node-crypto modules, replacing with stub...'.format(n))
print('  Remaining require(\"node:crypto\"): {}'.format(rem))

wc = nc.count('require(\"node:crypto\").webcrypto')
if wc > 0:
    nc = nc.replace('require(\"node:crypto\").webcrypto', 'globalThis.crypto.webcrypto')
    print('  Replaced {} webcrypto fallbacks'.format(wc))

with open('$HANDLER', 'w') as f:
    f.write(nc)
print('  Written.')
"

    # Verify the patch
    REMAINING=$(grep -c 'require("node:crypto")' "$HANDLER" 2>/dev/null || echo 0)
    echo "  Remaining require(\"node:crypto\"): $REMAINING"
  fi
fi

echo "Done."
