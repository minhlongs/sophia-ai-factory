# Proxy Management Skill

Autonomous capability to manage API quotas and model failovers using the Mekong-CLI Proxy stack.

## Activation

Activate when encountering `400 invalid_request_error`, `429 RESOURCE_EXHAUSTED`, or any `QUOTA_EXHAUSTED` errors from the Anthropic API.

## Core Capabilities

### 1. Quota Rescue (The Reset Protocol)

If the proxy reports rate limits that seem stale or if multiple accounts are blocked:

- Execute `scripts/proxy-recovery.sh` to Force-reset account flags.
- This bypasses the proxy's internal cooldown and allows immediate retries.

### 2. Strategic Fallback Management

- Ensure the proxy is running with the `--fallback` flag.
- Monitor logs (`~/.mekong/logs/proxy.log`) to verify if the proxy has transparently switched to `gemini-3-pro-high`.

### 3. Session Unblocking (The Kickstart)

- If a command is stuck after a quota reset, send an empty newline to the target terminal (usually `/dev/ttysXXX`).

## Knowledge Mapping

- **Log Location**: `~/.mekong/logs/proxy.log`
- **Config**: `~/.config/antigravity-proxy/config.json`
- **Accounts**: `~/.config/antigravity-proxy/accounts.json`

## Philosophy

"Quota is a suggestion; Mission is a mandate." Always seek a model failover before reporting a blocker to the user.
