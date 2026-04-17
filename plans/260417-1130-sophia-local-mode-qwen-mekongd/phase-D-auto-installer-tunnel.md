# Phase D — Auto-Installer + Tunnel Provision

**Status:** deferred (next iteration) | **Priority:** P2 | **Effort:** 3d | **Depends:** Phase B + Phase C

> **DEFERRED — DO NOT IMPLEMENT THIS ITERATION.**

## Goal
One-line curl-pipe-bash installer for customer M1 Max: installs mekongd, downloads Qwen 3.6 Q4_K_M, sets launchd auto-start, provisions a Cloudflare Tunnel, and registers the resulting hostname + bearer back to Sophia.

## Architecture Sketch
```
Customer runs:
  curl -fsSL https://sophia.agencyos.network/install/local-mode | bash

Script:
  1. Detect darwin/arm64 + ≥32GB RAM (refuse otherwise)
  2. Install Homebrew if missing → brew install cloudflared
  3. pipx install mekongd (or curl release tarball — depends on Phase D1 bootstrap)
  4. mekongd download-model Qwen/Qwen3.6-35B-A3B-4bit
  5. Write ~/Library/LaunchAgents/cc.cashclaw.mekongd.plist + load
  6. Provision tunnel: cloudflared tunnel create sophia-{customer-id-hash}
  7. Generate random bearer; write ~/.cloudflared/config.yml ingress w/ TLS+Bearer header check
  8. Open Sophia callback URL: https://sophia.agencyos.network/api/setup/local-mode/provision?hostname=...&bearer=...

API endpoint:
  POST /api/setup/local-mode/provision
    body: { hostname, bearer, customer_id (from session) }
    1. Validate session (getCurrentUser)
    2. Health-check: POST hostname/v1/messages w/ Bearer → expect 200
    3. encryptSecret(bearer) [Phase C]
    4. UPDATE users SET local_mode_endpoint=?, local_mode_bearer_encrypted=? WHERE id=?
    5. Emit signal `local_mode_provisioned`
```

## Related Code Files

### Create
- `scripts/sophia-local-mode-install.sh` (~150 LOC bash)
- `apps/sophia-ai-factory/src/app/api/setup/local-mode/provision/route.ts` (≤100 LOC)
- `apps/sophia-ai-factory/src/app/api/setup/local-mode/provision/route.test.ts` (≥4 tests)
- `apps/sophia-ai-factory/src/app/install/local-mode/route.ts` — serves install script (passes customer_id placeholder)

## Effort Estimate
- Bash installer + test on clean M1 Max VM: 1.5d
- API endpoint + tests: 1d
- End-to-end manual run-through: 0.5d

## Open Questions
- Does mekongd ship a launchd plist template, or do we author one? (TBD — check `~/mekong-cli/packages/mekongd/`)
- Tunnel provisioning: use CF API w/ scoped token (server-side) OR have user paste their CF account token? (Lean: server-side API token w/ Account.Cloudflare Tunnel:Edit scope.)
- Hostname collision: `sophia-{hash(customer_id)}.tunnel.agencyos.network` — confirm zone + DNS automation feasibility.
