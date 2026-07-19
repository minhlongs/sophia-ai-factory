#!/usr/bin/env bash
# scripts/harness/harness.sh
# Sophia AI Factory — Quality Harness
# Entry point: dispatches to subcommands.
#
# Usage:
#   ./scripts/harness/harness.sh audit [--gate N] [--fix] [--skip 2,4]
#   ./scripts/harness/harness.sh fix [--gate N]
#   ./scripts/harness/harness.sh report [--format markdown|json]
#   ./scripts/harness/harness.sh watch [--interval 5]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMANDS_DIR="$SCRIPT_DIR/commands"

CMD="${1:-audit}"
shift || true

case "$CMD" in
  audit)
    bash "$COMMANDS_DIR/audit.sh" "$@"
    ;;
  fix)
    bash "$COMMANDS_DIR/fix.sh" "$@"
    ;;
  report)
    bash "$COMMANDS_DIR/report.sh" "$@"
    ;;
  watch)
    echo "Watch mode — re-run audit on file changes (interval: ${1:-5}s)"
    while true; do
      bash "$COMMANDS_DIR/audit.sh" "$@"
      sleep "${1:-5}"
    done
    ;;
  --help|-h|help)
    cat << 'USAGE'
Sophia AI Factory — Quality Harness

Commands:
  audit [--gate N] [--fix] [--skip 2,4]   Run quality gates (default: all 8)
  fix [--gate N]                           Auto-fix :any, console.*, lint, i18n
  report [--format markdown|json]          Generate report from last run
  watch [--interval N]                     Watch mode — re-run on changes

Gates:
  1  typecheck    TypeScript type-check (tsc --noEmit)
  2  lint         ESLint validation
  3  tests        Vitest test suite
  4  security     Secrets + OWASP pattern scan
  5  bundle       Next.js build output size
  6  i18n         Translation key validation
  7  migrations   D1 pending migration check
  8  sha-match    Production SHA verification (informational)

Examples:
  ./scripts/harness/harness.sh audit              # Run all gates
  ./scripts/harness/harness.sh audit --gate 3     # Run tests only
  ./scripts/harness/harness.sh audit --fix        # Auto-fix + re-check
  ./scripts/harness/harness.sh audit --skip 5,8   # Skip bundle + sha-match
  ./scripts/harness/harness.sh fix                # Auto-fix all fixable
  ./scripts/harness/harness.sh report             # Generate markdown report
USAGE
    ;;
  *)
    echo "Unknown command: $CMD"
    echo "Run './scripts/harness/harness.sh --help' for usage."
    exit 1
    ;;
esac
