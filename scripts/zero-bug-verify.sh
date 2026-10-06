#!/usr/bin/env bash
# ==============================================================================
# scripts/zero-bug-verify.sh
# Root wrapper forwarding to apps/sophia-ai-factory/scripts/zero-bug-verify.sh
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/apps/sophia-ai-factory"
TARGET_SCRIPT="${TARGET_DIR}/scripts/zero-bug-verify.sh"

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo "❌ Target script not found: $TARGET_SCRIPT" >&2
  exit 1
fi

cd "$TARGET_DIR"
exec bash "$TARGET_SCRIPT" "$@"
