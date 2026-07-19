#!/usr/bin/env bash
# scripts/harness/lib/gates.sh
# Gate runner framework — setup, report, summary
# Each gate script sources this and calls gate_run / gate_skip / gate_report

set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
APP_DIR="$REPO_ROOT/apps/sophia-ai-factory"
EVIDENCE_DIR="$APP_DIR/plans/evidence"
STATE_DIR="$HARNESS_DIR/state"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$EVIDENCE_DIR" "$STATE_DIR"

# ── Color helpers ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Gate state ─────────────────────────────────────────────────
declare -A GATE_STATUS GATE_DURATION GATE_DETAILS GATE_FIXABLE
GATE_ORDER=()

# ── gate_register NAME ─────────────────────────────────────────
gate_register() {
  local name="$1"
  GATE_ORDER+=("$name")
  GATE_STATUS["$name"]="pending"
  GATE_DURATION["$name"]="0"
  GATE_DETAILS["$name"]=""
  GATE_FIXABLE["$name"]="false"
}

# ── gate_run NAME [duration_ms] [details_json] [fixable] ───────
gate_run() {
  local name="$1" dur="${2:-0}" details="${3:-[]}" fixable="${4:-false}"
  GATE_STATUS["$name"]="pass"
  GATE_DURATION["$name"]="$dur"
  GATE_DETAILS["$name"]="$details"
  GATE_FIXABLE["$name"]="$fixable"
}

# ── gate_fail NAME [duration_ms] [details_json] [fixable] ──────
gate_fail() {
  local name="$1" dur="${2:-0}" details="${3:-[]}" fixable="${4:-false}"
  GATE_STATUS["$name"]="fail"
  GATE_DURATION["$name"]="$dur"
  GATE_DETAILS["$name"]="$details"
  GATE_FIXABLE["$name"]="$fixable"
}

# ── gate_skip NAME reason ──────────────────────────────────────
gate_skip() {
  local name="$1" reason="$2"
  GATE_STATUS["$name"]="skip"
  GATE_DETAILS["$name"]="{\"reason\":\"$reason\"}"
}

# ── gate_summary ───────────────────────────────────────────────
# Prints: PASS|FAIL|SKIP per gate, then overall
gate_summary() {
  local pass=0 fail=0 skip=0 overall="PASS"
  for name in "${GATE_ORDER[@]}"; do
    local s="${GATE_STATUS[$name]}"
    case "$s" in
      pass) pass=$((pass+1)); printf "${GREEN}✅ %-20s${RESET} %sms\n" "$name" "${GATE_DURATION[$name]}" ;;
      fail) fail=$((fail+1)); overall="FAIL"; printf "${RED}❌ %-20s${RESET} %sms\n" "$name" "${GATE_DURATION[$name]}" ;;
      skip) skip=$((skip+1)); printf "${YELLOW}⏭️  %-20s${RESET} %sms\n" "$name" "${GATE_DURATION[$name]}" ;;
    esac
  done
  echo ""
  printf "${BOLD}Overall: %s | pass=%d fail=%d skip=%d${RESET}\n" "$overall" "$pass" "$fail" "$skip"
  echo "$overall"
}

# ── gate_save_state ────────────────────────────────────────────
# Persist last run for `harness report` delta
gate_save_state() {
  local overall="$1"
  local json="{"
  json+="\"timestamp\":\"$TIMESTAMP\","
  json+="\"overall\":\"$overall\","
  json+="\"gates\":{"
  local first=true
  for name in "${GATE_ORDER[@]}"; do
    if [ "$first" = true ]; then first=false; else json+=","; fi
    json+="\"$name\":{"
    json+="\"status\":\"${GATE_STATUS[$name]}\","
    json+="\"duration_ms\":${GATE_DURATION[$name]},"
    json+="\"details\":${GATE_DETAILS[$name]},"
    json+="\"fixable\":${GATE_FIXABLE[$name]}"
    json+="}"
  done
  json+="}}"
  echo "$json" > "$STATE_DIR/last-run.json"
}

# ── gate_load_previous ─────────────────────────────────────────
# Returns JSON of previous run, or empty
gate_load_previous() {
  if [ -f "$STATE_DIR/last-run.json" ]; then
    cat "$STATE_DIR/last-run.json"
  fi
}
