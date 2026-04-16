#!/usr/bin/env bash
# seed-wrangler-markers.sh — P1 first-commit only
# Inserts marker fences into wrangler.toml + wrangler.jsonc so P2/P3 can append cleanly.
# Idempotent: skips insertion if markers already present.
# RED-TEAM #4: prevents wrangler shared-file race across parallel phases.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOML="$REPO_ROOT/apps/sophia-ai-factory/wrangler.toml"
JSONC="$REPO_ROOT/wrangler.jsonc"

# ── TOML markers ──────────────────────────────────────────────────────────────
TOML_P1_BEGIN="# === P1-VARS-BEGIN ==="
if grep -qF "$TOML_P1_BEGIN" "$TOML"; then
  echo "[seed] wrangler.toml markers already present — skipping"
else
  cat >> "$TOML" << 'TOML_MARKERS'

# === P1-VARS-BEGIN ===
# vars block managed by P1 — phase 1 CI/CD enforcement
# COMMIT_SHA and DEPLOYED_AT are injected as CF Secrets (not vars) via wrangler-set-build-vars.sh
# === P1-VARS-END ===

# === P2-CRONS-BEGIN ===
# P2 appends cron triggers here (error-digest, heartbeat)
# === P2-CRONS-END ===

# === P3-CRONS-BEGIN ===
# P3 appends cron triggers here (weekly-signals-digest)
# === P3-CRONS-END ===

# === P3-KV-BEGIN ===
# P3 appends KV namespace bindings here (EXPERIMENT_KV)
# === P3-KV-END ===
TOML_MARKERS
  echo "[seed] wrangler.toml markers inserted"
fi

# ── JSONC markers ─────────────────────────────────────────────────────────────
JSONC_P1_BEGIN="P1-VARS-BEGIN"
if grep -qF "$JSONC_P1_BEGIN" "$JSONC"; then
  echo "[seed] wrangler.jsonc markers already present — skipping"
else
  # Insert markers before closing brace of JSON object
  # Strategy: use Python for reliable JSON-with-comments manipulation
  python3 - "$JSONC" << 'PYEOF'
import sys, re

path = sys.argv[1]
content = open(path).read()

markers = '''
\t// === P1-VARS-BEGIN ===
\t// vars block managed by P1 — appended above. COMMIT_SHA/DEPLOYED_AT are CF Secrets.
\t// === P1-VARS-END ===

\t// === P2-CRONS-BEGIN ===
\t// P2 appends cron triggers here
\t// === P2-CRONS-END ===

\t// === P3-CRONS-BEGIN ===
\t// P3 appends cron triggers here
\t// === P3-CRONS-END ===

\t// === P3-KV-BEGIN ===
\t// P3 appends KV namespace bindings here
\t// === P3-KV-END ===
'''

# Insert before the last closing brace
idx = content.rfind('}')
if idx == -1:
    print("[seed] ERROR: no closing brace found in wrangler.jsonc", file=sys.stderr)
    sys.exit(1)

new_content = content[:idx] + markers + content[idx:]
open(path, 'w').write(new_content)
print("[seed] wrangler.jsonc markers inserted")
PYEOF
fi

echo "[seed] Done. Marker fences seeded for P1/P2/P3 parallel phase work."
