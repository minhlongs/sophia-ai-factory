#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}/apps/sophia-ai-factory"
exec bash scripts/check-migration-coverage.sh "$@"
