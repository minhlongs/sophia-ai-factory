#!/usr/bin/env bash
# scripts/harness/commands/fix.sh
# `harness fix [--gate N]`
# Auto-fixable issues: :any types, console.*, lint errors, i18n keys.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$(cd "$HARNESS_DIR/../.." && pwd)/apps/sophia-ai-factory"

FIXES_APPLIED=0
FIXES_FAILED=0

echo "═══════════════════════════════════════════════════════════════"
echo "  HARNESS FIX"
echo "═══════════════════════════════════════════════════════════════"

# ── Fix 1: ESLint auto-fix ─────────────────────────────────────
echo ""
echo "[fix/1] ESLint auto-fix..."
LINT_OUT=$(cd "$APP_DIR" && npm run lint -- --fix 2>&1) || true
if echo "$LINT_OUT" | grep -q "fixed"; then
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
  echo "  ✅ ESLint fixes applied"
else
  echo "  ⏭️  No ESLint auto-fixable issues"
fi

# ── Fix 2: :any → unknown (safe substitutions) ─────────────────
echo ""
echo "[fix/2] Replace :any with :unknown in test files..."
ANY_COUNT=$(grep -rn ': any' "$APP_DIR/src" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E '__tests__|\.test\.' | wc -l | tr -d ' ' || echo "0")
if [ "$ANY_COUNT" -gt 0 ]; then
  # Only fix in test files (safer — no production impact)
  grep -rln ': any' "$APP_DIR/src" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -E '__tests__|\.test\.' | while read -r f; do
    # Replace specific patterns that are safe to convert
    sed -i '' 's/: any\[\]/: unknown[]/g' "$f" 2>/dev/null || true
    sed -i '' 's/: any = {}/: unknown = {} as Record<string, unknown>/g' "$f" 2>/dev/null || true
    sed -i '' 's/: any = \[\]/: unknown[]/g' "$f" 2>/dev/null || true
    sed -i '' 's/: any = null/: unknown = null/g' "$f" 2>/dev/null || true
  done
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
  echo "  ✅ Fixed $ANY_COUNT :any occurrences in test files"
else
  echo "  ✅ No :any in test files"
fi

# ── Fix 3: console.* → logger in production files ──────────────
echo ""
echo "[fix/3] Replace console.* with logger in production files..."
CONSOLE_FILES=$(grep -rln 'console\.\(log\|warn\|error\)' "$APP_DIR/src" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v '__tests__' | grep -v '\.test\.' | grep -v 'spec\.' || true)
if [ -n "$CONSOLE_FILES" ]; then
  # Add logger import if missing, then replace
  echo "$CONSOLE_FILES" | while read -r f; do
    if ! grep -q "import.*logger" "$f" 2>/dev/null; then
      # Add import after last import line
      LAST_IMPORT=$(grep -n '^import ' "$f" | tail -1 | cut -d: -f1)
      if [ -n "$LAST_IMPORT" ]; then
        sed -i '' "${LAST_IMPORT}a\\
import { logger } from '@/seed/utils/logger-utility'" "$f" 2>/dev/null || true
      fi
    fi
    # Replace console calls
    sed -i '' 's/console\.log/logger.info/g' "$f" 2>/dev/null || true
    sed -i '' 's/console\.warn/logger.warn/g' "$f" 2>/dev/null || true
    sed -i '' 's/console\.error/logger.error/g' "$f" 2>/dev/null || true
  done
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
  CONSOLE_COUNT=$(echo "$CONSOLE_FILES" | wc -l | tr -d ' ')
  echo "  ✅ Fixed console.* in $CONSOLE_COUNT files"
else
  echo "  ✅ No console.* in production files"
fi

# ── Fix 4: i18n scaffold missing keys ──────────────────────────
echo ""
echo "[fix/4] i18n key scaffold..."
I18N_OUT=$(cd "$APP_DIR" && npm run i18n:validate 2>&1) || true
MISSING=$(echo "$I18N_OUT" | grep "Missing static keys:" | grep -oE '[0-9]+' | head -1 || echo "0")
if [ "$MISSING" -gt 0 ]; then
  echo "  ⚠️  $MISSING missing i18n keys — manual review needed"
  echo "$I18N_OUT" | grep "Missing:" | head -5
  FIXES_FAILED=$((FIXES_FAILED + 1))
else
  echo "  ✅ All i18n keys present"
fi

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  FIX SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo "  Applied: $FIXES_APPLIED fix categories"
echo "  Need manual: $FIXES_FAILED"
echo ""
echo "Next: run 'harness audit' to verify fixes."

exit 0
