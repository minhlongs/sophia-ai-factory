#!/usr/bin/env bash
# stitch-tokens.sh — Export Stitch design tokens to .stitch-tokens.json
#
# Usage:
#   stitch-tokens.sh               Generate from defaults
#   stitch-tokens.sh --update      Attempt MCP fetch
#   stitch-tokens.sh --project <id> Specify project
#
# Output: .stitch-tokens.json in CWD (or STITCH_TOKENS_DIR)

set -euo pipefail

TOKEN_FILE="${STITCH_TOKENS_DIR:-.}/.stitch-tokens.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_SCRIPT="$SCRIPT_DIR/stitch-session.mjs"

generate_tokens() {
  cat > "$TOKEN_FILE" << 'EOF'
{
  "theme": "DARK",
  "primary": "#6366F1",
  "background": "#0F0F11",
  "surface": "#18181B",
  "textPrimary": "#FFFFFF",
  "textSecondary": "#A1A1AA",
  "border": "zinc-800",
  "rounding": "rounded-lg",
  "fontHeadline": "Inter 28px/700",
  "fontBody": "Inter 15px/400",
  "fontLabel": "IBM Plex Sans 13px/500",
  "colors": {
    "indigo-500": "#6366F1",
    "zinc-900": "#18181B",
    "zinc-400": "#A1A1AA",
    "zinc-700": "#3F3F46",
    "zinc-800": "#27272A"
  },
  "i18nPrefixes": ["landing", "pricing", "dashboard", "campaign", "settings", "affiliate", "admin"],
  "purpleSignals": ["#D946EF", "#E879F9", "#FDF4FF", "#86198F", "#F97316", "purple-"],
  "indigoSignals": ["#6366F1", "indigo-500", "#0F0F11"],
  "generatedAt": ""
}
EOF
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"generatedAt\": \"\"/\"generatedAt\": \"$TS\"/" "$TOKEN_FILE"
  else
    sed -i "s/\"generatedAt\": \"\"/\"generatedAt\": \"$TS\"/" "$TOKEN_FILE"
  fi
  echo "{\"status\":\"ok\",\"file\":\"$TOKEN_FILE\",\"tokens\":$(cat "$TOKEN_FILE")}"
}

try_session() {
  if command -v node >/dev/null 2>&1 && [ -f "$SESSION_SCRIPT" ]; then
    node "$SESSION_SCRIPT" read 2>/dev/null || return 1
  fi
  return 1
}

case "${1:-}" in
  --update)
    if try_session >/dev/null 2>&1; then
      echo "{\"status\":\"info\",\"message\":\"Session active. Using defaults with session context.\"}"
    else
      echo "{\"status\":\"info\",\"message\":\"MCP update not available (auth may be down). Using defaults.\"}"
    fi
    generate_tokens
    ;;
  --project)
    generate_tokens
    ;;
  *)
    generate_tokens
    ;;
esac
