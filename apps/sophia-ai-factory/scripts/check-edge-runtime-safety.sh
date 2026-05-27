#!/usr/bin/env bash
# check-edge-runtime-safety.sh
#
# Guards against Edge-Runtime-incompatible Node APIs landing in files
# that may be imported (transitively) from middleware/edge code paths.
#
# Background: Next.js Edge Runtime statically rejects any module that
# references `process.on(...)`, `process.exit(...)`, `process.kill(...)`
# even when guarded behind typeof checks — the analyzer matches on the
# literal call site, not reachability. See the 2026-05-11 incident where
# usage-metering/batch-buffer.ts blocked `npm run dev`.
#
# Rule: every file under `src/**/*.ts` that contains one of the banned
# Node-only APIs MUST also contain a magic comment:
#   `// @edge-runtime-allowed: <one-line reason>`
# acknowledging that the contributor has gated the call so it cannot run
# at module evaluation time (e.g. wrapped in an exported function called
# only from instrumentation.ts / scripts/).
#
# Allowlist: tests, scripts, and instrumentation.ts itself are exempt
# (they are Node-only entrypoints by design).
#
# Usage:
#   bash scripts/check-edge-runtime-safety.sh
#
# Exit codes:
#   0  no unannotated module-level Node APIs found
#   1  at least one unannotated occurrence

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Patterns we never want hit at top level of an Edge-importable module.
BANNED_PATTERN='process\.(on|exit|kill|abort|chdir|disconnect|setMaxListeners)\('

# Files we never check.
EXCLUDE_PATHS='(\.test\.ts|\.spec\.ts|/__tests__/|/_fixtures/|/scripts/|/tests/)'

violations=0
allowlisted=0
checked=0

# Use grep to find all candidate files containing the banned pattern
# to avoid spawning grep on every single file in the codebase.
while IFS= read -r ts_file; do
  [ -z "$ts_file" ] && continue

  # Skip excluded paths
  if printf '%s' "$ts_file" | grep -qE "$EXCLUDE_PATHS"; then
    continue
  fi

  checked=$((checked + 1))

  # Allowlist: file must explicitly acknowledge the risk
  if grep -qE '@edge-runtime-allowed' "$ts_file"; then
    allowlisted=$((allowlisted + 1))
    continue
  fi

  # Otherwise flag every banned line with line number
  while IFS= read -r line; do
    echo "VIOLATION: ${ts_file}:${line}"
    violations=$((violations + 1))
  done < <(grep -nE "$BANNED_PATTERN" "$ts_file" | cut -d: -f1)
done < <(grep -rlE "$BANNED_PATTERN" src instrumentation.ts 2>/dev/null | grep -E '\.ts$' || true)

echo
echo "Edge Runtime safety check:"
echo "  Files inspected (contain banned API):  $checked"
echo "  Files allowlisted via @edge-runtime-allowed: $allowlisted"
echo "  Unannotated violations:                $violations"

if [ "$violations" -gt 0 ]; then
  cat >&2 <<EOF

ACTION: For each violation, do ONE of the following:
  1. Move the call into an exported function body (e.g.
     installShutdownHandlers()) and invoke it from instrumentation.ts
     under NEXT_RUNTIME === 'nodejs'. Then add the magic comment:
       // @edge-runtime-allowed: <why this is safe — call site / guard>
  2. If the file is genuinely Node-only and never reachable from
     middleware, add the @edge-runtime-allowed comment directly with
     a reason explaining why it cannot reach the Edge bundle.

Context: 2026-05-11 — usage-metering/batch-buffer.ts had module-level
process.on calls. Next.js dev server failed to boot. Fix: commit 58c7192b.

Pattern detection is intentionally aggressive (catches the call even
when inside an obviously-safe function body) because false positives
are cheap (one comment line) and false negatives broke production
locally for ~hours.
EOF
  exit 1
fi

echo "OK — no unannotated Node-only Process APIs in Edge-importable modules."
