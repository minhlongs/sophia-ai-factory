#!/bin/bash
# deploy-utils.sh — Shared helper functions for deploy scripts
# Used by deploy-with-sha.sh and other deploy-related scripts.
# Source: source "$(dirname "$0")/lib/deploy-utils.sh"
#
# Provides:
#   log_info, log_warn, log_error  — Timestamped logging to both stdout/stderr and
#                                    DEPLOY_LOG file.
#   retry <label> <attempts> <delay> <cmd...> — Retry a command N times with delay.
#   retry_cf <label> <cmd...>       — CF-specific retry: 3 attempts, 5s initial delay,
#                                     exponential backoff.
#   fetch_url <url>                 — Hardened curl wrapper with --fail, --retry,
#                                     timeouts, and --noproxy fallback.
#   fetch_status <url>              — Returns HTTP status code only.
#   cache_bust_url <url> <nonce>    — Appends or injects deployVerify query param.
#   extract_short_sha               — Reads JSON from stdin, outputs shortSha field.
#   verify_deploy_sha <url> <sha> [max_attempts] — Polls /api/version until SHA matches.

# Deploy log file (default: /tmp/sophia-deploy-<timestamp>.log).
# Override via DEPLOY_LOG env var.
DEPLOY_LOG="${DEPLOY_LOG:-/tmp/sophia-deploy-$(date +%Y%m%d-%H%M%S).log}"
# Ensure log file is writable; fall back to /dev/null if /tmp is full.
touch "$DEPLOY_LOG" 2>/dev/null || DEPLOY_LOG="/dev/null"

# ─── Logging helpers ──────────────────────────────────────────────────────────
# Write to stdout (info) or stderr (warn/error) AND append to DEPLOY_LOG with
# ISO-8601 timestamp for audit trail.
log_info()  { echo "==> $*"; echo "[INFO] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$DEPLOY_LOG"; }
log_warn()  { echo "  $*" >&2; echo "[WARN] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$DEPLOY_LOG"; }
log_error() { echo "  $*" >&2; echo "[ERROR] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$DEPLOY_LOG"; }

# ─── Retry helper ─────────────────────────────────────────────────────────────
# Retry a command N times with initial delay (linear, not exponential).
# Permanent errors (auth, validation, etc) still fail on first attempt — only
# transient 5xx and network errors merit retry.
# Usage: retry <label> <attempts> <delay_seconds> <command...>
retry() {
  local label="$1"; shift
  local max="$1"; shift
  local delay="$1"; shift
  local attempt=1
  while [ $attempt -le "$max" ]; do
    if "$@" 2>>"$DEPLOY_LOG"; then return 0; fi
    if [ $attempt -eq "$max" ]; then
      log_error "$label failed after $max attempts — aborting deploy"
      return 1
    fi
    log_warn "$label failed (attempt $attempt/$max), retrying in ${delay}s..."
    sleep "$delay"
    attempt=$((attempt + 1))
    delay=$((delay * 2))
  done
}

# CF-specific retry: 3 attempts, 5s initial delay, exponential backoff (5s, 10s, 20s).
# Cloudflare returned 502 Bad Gateway during `secret put` on 2026-05-17 (commit
# c1528012 deploy), leaving deploy half-done. This retry eliminates that class of
# transient failures.
retry_cf() {
  local label="$1"; shift
  retry "$label" 3 5 "$@"
}

# ─── Hardened curl wrappers ───────────────────────────────────────────────────
# All curl calls use --fail, --retry, --connect-timeout, and --max-time to prevent
# hangs on transient network failures and to surface HTTP errors (4xx/5xx) as
# non-zero exits. Stderr is captured to DEPLOY_LOG instead of /dev/null.

# Fetch URL body content.
# Falls back to --noproxy '*' (local SOCKS5 proxy breaks wrangler fetch to CF API).
fetch_url() {
  local url="$1"
  curl --fail -fsS \
    --retry 3 --retry-delay 5 \
    --connect-timeout 10 --max-time 30 \
    "$url" 2>>"$DEPLOY_LOG" || \
  curl --fail -fsS \
    --retry 3 --retry-delay 5 \
    --connect-timeout 10 --max-time 30 \
    --noproxy '*' "$url" 2>>"$DEPLOY_LOG"
}

# Fetch HTTP status code only (outputs "200", "503", etc.). Does not download body.
fetch_status() {
  local url="$1"
  curl --fail -sSL \
    --retry 3 --retry-delay 5 \
    --connect-timeout 10 --max-time 30 \
    -o /dev/null -w "%{http_code}" \
    "$url" 2>>"$DEPLOY_LOG" || \
  curl --fail -sSL \
    --retry 3 --retry-delay 5 \
    --connect-timeout 10 --max-time 30 \
    -o /dev/null -w "%{http_code}" \
    --noproxy '*' "$url" 2>>"$DEPLOY_LOG"
}

# Append or inject deployVerify query parameter for cache busting.
# Example: https://example.com/api/version -> https://example.com/api/version?deployVerify=abc123
#          https://example.com/api?key=val -> https://example.com/api?key=val&deployVerify=abc123
cache_bust_url() {
  local url="$1"
  local nonce="$2"
  case "$url" in
    *\?*) printf '%s&deployVerify=%s' "$url" "$nonce" ;;
    *) printf '%s?deployVerify=%s' "$url" "$nonce" ;;
  esac
}

# ─── SHA extraction ───────────────────────────────────────────────────────────
# Extract shortSha field from /api/version JSON response, reading from stdin.
# Silently returns empty string on parse failure (non-JSON response, missing field).
extract_short_sha() {
  node -e "
    let input = '';
    process.stdin.on('data', c => input += c);
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(input);
        if (typeof parsed.shortSha === 'string') process.stdout.write(parsed.shortSha);
      } catch {}
    });
  "
}

# ─── Deploy SHA verification ──────────────────────────────────────────────────
# Poll /api/version (with cache busting) until the deployed shortSha matches the
# expected commit short SHA. Uses fetch_url which already has retry+timeout built in.
# Arguments:
#   $1 — URL to version endpoint (cache-busted)
#   $2 — Expected short SHA (8 chars)
#   $3 — Max polling attempts (default: 12, ~60s total with 5s intervals)
# Returns 0 on match, 1 after all attempts exhausted.
verify_deploy_sha() {
  local verify_url="$1"
  local expected_sha="$2"
  local max_attempts="${3:-12}"
  local live_sha=""
  local version_json=""
  local attempt=1

  while [ $attempt -le "$max_attempts" ]; do
    if version_json=$(fetch_url "$verify_url" 2>>"$DEPLOY_LOG"); then
      live_sha=$(printf '%s' "$version_json" | extract_short_sha 2>>"$DEPLOY_LOG")
      if [ -n "$live_sha" ] && [ "$live_sha" = "$expected_sha" ]; then
        log_info "Deploy SHA match: $live_sha"
        return 0
      fi
    fi
    if [ $attempt -lt "$max_attempts" ]; then
      log_warn "Deploy SHA not visible yet (attempt $attempt/$max_attempts): local=$expected_sha live=${live_sha:-missing}"
    fi
    sleep 5
    attempt=$((attempt + 1))
  done

  log_error "Deploy SHA mismatch after propagation wait: local=$expected_sha live=${live_sha:-missing}"
  [ -n "${version_json:-}" ] && log_error "Version response: $version_json"
  return 1
}
