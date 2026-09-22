#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy-with-sha.sh
# Root wrapper forwarding to apps/sophia-ai-factory/scripts/deploy-with-sha.sh
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_SCRIPT="${REPO_ROOT}/apps/sophia-ai-factory/scripts/deploy-with-sha.sh"

if [ ! -f "$TARGET_SCRIPT" ]; then
  echo "❌ Target script not found: $TARGET_SCRIPT" >&2
  exit 1
fi

exec bash "$TARGET_SCRIPT" "$@"
