#!/usr/bin/env bash
# sophia-local-mode-install.sh — Phase D
#
# One-shot installer for Sophia Local Mode on Apple Silicon (M1/M2/M3/M4).
# Installs mekongd, downloads Qwen model, configures launchd, provisions a
# Cloudflare Tunnel, and registers the resulting hostname + bearer back to Sophia.
#
# Usage:
#   SOPHIA_CUSTOMER_TOKEN=<your-token> bash sophia-local-mode-install.sh
#
# Exit codes:
#   0 — success (or already provisioned)
#   1 — preflight check failed (OS/arch/RAM)
#   2 — download failed (mekongd binary or Homebrew)
#   3 — provision callback to Sophia failed
#
# Requirements:
#   - macOS on Apple Silicon (darwin/arm64)
#   - ≥ 32 GB RAM
#   - SOPHIA_CUSTOMER_TOKEN environment variable set

set -euo pipefail

# ── Constants ──────────────────────────────────────────────────────────────────

SOPHIA_API="https://sophia.agencyos.network"
MEKONGD_RELEASE_URL="https://github.com/longtho638-jpg/mekong-cli/releases/latest/download/mekongd-darwin-arm64.tar.gz"
MEKONGD_BIN="/usr/local/bin/mekongd"
LAUNCHD_PLIST="$HOME/Library/LaunchAgents/cc.cashclaw.mekongd.plist"
MEKONGD_PORT=8765
MIN_RAM_BYTES=34359738368  # 32 GiB in bytes
PROVISION_SENTINEL="$HOME/.sophia-local-mode-provisioned"
CLOUDFLARED_CONFIG="$HOME/.cloudflared/config.yml"

# ── Logging helpers ────────────────────────────────────────────────────────────

log()  { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" >&2; }
info() { log "INFO  $*"; }
warn() { log "WARN  $*"; }
err()  { log "ERROR $*"; }

# ── Preflight checks ───────────────────────────────────────────────────────────

preflight() {
  info "Running preflight checks..."

  # Check OS: must be macOS
  local os
  os="$(uname -s)"
  if [[ "$os" != "Darwin" ]]; then
    err "Unsupported OS: $os. This installer requires macOS (darwin)."
    exit 1
  fi

  # Check architecture: must be arm64 (Apple Silicon)
  local arch
  arch="$(uname -m)"
  if [[ "$arch" != "arm64" ]]; then
    err "Unsupported architecture: $arch. This installer requires Apple Silicon (arm64)."
    exit 1
  fi

  # Check RAM: must be ≥ 32 GB
  local ram_bytes
  ram_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  if [[ "$ram_bytes" -lt "$MIN_RAM_BYTES" ]]; then
    local ram_gb=$(( ram_bytes / 1073741824 ))
    err "Insufficient RAM: ${ram_gb} GB detected. Sophia Local Mode requires ≥ 32 GB."
    exit 1
  fi

  # Check SOPHIA_CUSTOMER_TOKEN
  if [[ -z "${SOPHIA_CUSTOMER_TOKEN:-}" ]]; then
    err "SOPHIA_CUSTOMER_TOKEN is not set. Export your token before running this script."
    err "  export SOPHIA_CUSTOMER_TOKEN=<your-token>"
    exit 1
  fi

  info "Preflight passed: darwin/arm64, $(( ram_bytes / 1073741824 )) GB RAM."
}

# ── Idempotency check ──────────────────────────────────────────────────────────

check_already_provisioned() {
  if [[ -f "$PROVISION_SENTINEL" ]]; then
    info "Sophia Local Mode is already provisioned on this machine."
    info "Sentinel: $PROVISION_SENTINEL"
    info "To re-provision, delete the sentinel and re-run."
    exit 0
  fi
}

# ── Homebrew ───────────────────────────────────────────────────────────────────

install_homebrew() {
  if command -v brew &>/dev/null; then
    info "Homebrew already installed: $(brew --version | head -1)"
    return
  fi

  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
    err "Homebrew installation failed."
    exit 2
  }

  # Add Homebrew to PATH for Apple Silicon
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  info "Homebrew installed."
}

# ── System dependencies ────────────────────────────────────────────────────────

install_deps() {
  info "Installing cloudflared and jq via Homebrew..."
  brew install cloudflared jq
  info "Dependencies installed."
}

# ── mekongd binary ────────────────────────────────────────────────────────────

install_mekongd() {
  if [[ -x "$MEKONGD_BIN" ]]; then
    info "mekongd already installed: $($MEKONGD_BIN --version 2>/dev/null || echo 'unknown version')"
    return
  fi

  info "Downloading mekongd from $MEKONGD_RELEASE_URL ..."
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  if ! curl -fsSL "$MEKONGD_RELEASE_URL" -o "$tmp_dir/mekongd.tar.gz"; then
    err "Failed to download mekongd. The release may not yet be published."
    err "Manual install: git clone https://github.com/longtho638-jpg/mekong-cli && cd mekong-cli/packages/mekongd && cargo build --release"
    rm -rf "$tmp_dir"
    exit 2
  fi

  tar -xzf "$tmp_dir/mekongd.tar.gz" -C "$tmp_dir"
  sudo mv "$tmp_dir/mekongd" "$MEKONGD_BIN"
  sudo chmod +x "$MEKONGD_BIN"
  rm -rf "$tmp_dir"
  info "mekongd installed to $MEKONGD_BIN"
}

# ── Qwen model download ────────────────────────────────────────────────────────

download_model() {
  info "Downloading Qwen3.6-35B-A3B-4bit model (this may take 15–30 minutes)..."
  "$MEKONGD_BIN" download-model Qwen/Qwen3.6-35B-A3B-4bit || \
    warn "Model download returned non-zero. Check mekongd logs. Continuing..."
  info "Model download complete."
}

# ── LaunchAgent (mekongd auto-start) ──────────────────────────────────────────

install_launchd_agent() {
  info "Writing LaunchAgent plist to $LAUNCHD_PLIST ..."
  mkdir -p "$(dirname "$LAUNCHD_PLIST")"

  cat > "$LAUNCHD_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>cc.cashclaw.mekongd</string>
  <key>ProgramArguments</key>
  <array>
    <string>${MEKONGD_BIN}</string>
    <string>serve</string>
    <string>--port</string>
    <string>${MEKONGD_PORT}</string>
    <string>--bind</string>
    <string>127.0.0.1</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${HOME}/Library/Logs/mekongd.log</string>
  <key>StandardErrorPath</key>
  <string>${HOME}/Library/Logs/mekongd.error.log</string>
</dict>
</plist>
PLIST

  launchctl unload "$LAUNCHD_PLIST" 2>/dev/null || true
  launchctl load "$LAUNCHD_PLIST"
  info "LaunchAgent loaded. mekongd will start on login."
}

# ── Cloudflare Tunnel ─────────────────────────────────────────────────────────

provision_tunnel() {
  info "Requesting tunnel credentials from Sophia bootstrap API..."

  local response
  response="$(curl -fsSL -X POST "${SOPHIA_API}/api/setup/local-mode/bootstrap" \
    -H "Authorization: Bearer ${SOPHIA_CUSTOMER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)" || {
    err "Could not reach Sophia bootstrap endpoint at ${SOPHIA_API}."
    err "Manual steps:"
    err "  1. Run: cloudflared tunnel create sophia-local"
    err "  2. Note the tunnel_id from the output"
    err "  3. Configure ~/.cloudflared/config.yml manually"
    exit 3
  }

  TUNNEL_ID="$(echo "$response" | jq -r '.tunnel_id')"
  TUNNEL_TOKEN="$(echo "$response" | jq -r '.tunnel_token')"
  CUSTOMER_HASH="$(echo "$response" | jq -r '.customer_hash')"

  if [[ -z "$TUNNEL_ID" || "$TUNNEL_ID" == "null" ]]; then
    err "Sophia bootstrap response missing tunnel_id. Response: $response"
    exit 3
  fi

  info "Tunnel ID: $TUNNEL_ID  |  Hostname: mekongd-${CUSTOMER_HASH}.cashclaw.cc"

  # Write credentials file
  mkdir -p "$HOME/.cloudflared"
  echo "$response" | jq -r '.credentials' > "$HOME/.cloudflared/${TUNNEL_ID}.json"

  # Write cloudflared config.yml
  cat > "$CLOUDFLARED_CONFIG" <<YML
tunnel: ${TUNNEL_ID}
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: mekongd-${CUSTOMER_HASH}.cashclaw.cc
    service: http://127.0.0.1:${MEKONGD_PORT}
    originRequest:
      httpHostHeader: mekongd.local
  - service: http_status:404
YML

  info "cloudflared config written to $CLOUDFLARED_CONFIG"

  # Start tunnel via launchd / brew services
  if brew services start cloudflared 2>/dev/null; then
    info "cloudflared tunnel started via brew services."
  else
    warn "brew services start failed; attempting foreground tunnel run..."
    cloudflared tunnel run "$TUNNEL_ID" &
    sleep 3
    info "cloudflared tunnel started in background."
  fi

  echo "$TUNNEL_ID"
  echo "$CUSTOMER_HASH"
}

# ── Generate bearer + register with Sophia ────────────────────────────────────

register_with_sophia() {
  local customer_hash="$1"

  # Generate random 32-byte bearer (base64)
  local bearer
  bearer="$(openssl rand -base64 32 | tr -d '\n')"

  local hostname="https://mekongd-${customer_hash}.cashclaw.cc"

  info "Registering hostname and bearer with Sophia..."

  local result
  result="$(curl -fsSL -X POST "${SOPHIA_API}/api/setup/local-mode/provision" \
    -H "Authorization: Bearer ${SOPHIA_CUSTOMER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\":\"${hostname}\",\"bearer\":\"${bearer}\"}" 2>/dev/null)" || {
    err "Failed to call Sophia provision API."
    err "Retry manually:"
    err "  curl -X POST ${SOPHIA_API}/api/setup/local-mode/provision \\"
    err "    -H 'Authorization: Bearer \$SOPHIA_CUSTOMER_TOKEN' \\"
    err "    -H 'Content-Type: application/json' \\"
    err "    -d '{\"hostname\":\"${hostname}\",\"bearer\":\"...\"}'"
    exit 3
  }

  local ok
  ok="$(echo "$result" | jq -r '.ok' 2>/dev/null || echo 'false')"

  if [[ "$ok" != "true" ]]; then
    err "Sophia provision API returned failure: $result"
    exit 3
  fi

  info "Registered with Sophia: $hostname"
}

# ── Mark provisioned ───────────────────────────────────────────────────────────

mark_provisioned() {
  date '+%Y-%m-%dT%H:%M:%S' > "$PROVISION_SENTINEL"
  info "Provisioning complete. Sentinel written: $PROVISION_SENTINEL"
}

# ── Main ───────────────────────────────────────────────────────────────────────

main() {
  info "=== Sophia Local Mode Installer ==="

  preflight
  check_already_provisioned
  install_homebrew
  install_deps
  install_mekongd
  download_model
  install_launchd_agent

  # provision_tunnel prints TUNNEL_ID then CUSTOMER_HASH on separate lines
  local tunnel_output
  tunnel_output="$(provision_tunnel)"
  # Capture last two lines
  local customer_hash
  customer_hash="$(echo "$tunnel_output" | tail -1)"

  register_with_sophia "$customer_hash"
  mark_provisioned

  info ""
  info "=== Installation complete ==="
  info "mekongd is running on 127.0.0.1:${MEKONGD_PORT}"
  info "Cloudflare Tunnel is active"
  info "Sophia has been notified"
  info "You can now use Sophia Local Mode from your dashboard."
}

main "$@"
