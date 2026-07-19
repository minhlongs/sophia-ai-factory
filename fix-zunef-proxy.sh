#!/bin/bash
# Fix ZuneF cooldown by removing fixed device ID header

SETTINGS_FILE="$HOME/.claude/settings.json"

echo "🔧 Fixing ZuneF proxy config..."

# Backup
cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%s)" 2>/dev/null || true

# Remove X-Device-Id from ANTHROPIC_CUSTOM_HEADERS
if grep -q '"ANTHROPIC_CUSTOM_HEADERS"' "$SETTINGS_FILE"; then
  sed -i '' "s/'X-Device-Id':deviceId//g" "$SETTINGS_FILE"
  echo "✅ Removed fixed X-Device-Id from custom headers"
fi

# Remove old device credentials
rm -f "$HOME/.claude/zunef-device-id" "$HOME/.claude/zunef-device-token"
echo "✅ Removed old device credentials"

# Verify apiKeyHelper will create new dynamic device ID
echo ""
echo "📋 Current apiKeyHelper snippet:"
grep -A5 "apiKeyHelper" "$SETTINGS_FILE" | head -6

echo ""
echo "🎯 Next steps:"
echo "1. Restart Claude Code CLI"
echo "2. If still cooldown, switch to Anthropic direct:"
echo "   export ANTHROPIC_BASE_URL=https://api.anthropic.com"
echo "   export ANTHROPIC_API_KEY=sk-ant-..."
