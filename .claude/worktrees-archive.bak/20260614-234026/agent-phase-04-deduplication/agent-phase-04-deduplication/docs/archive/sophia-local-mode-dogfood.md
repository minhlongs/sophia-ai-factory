# Sophia Local Mode — Founder Dogfood Runbook (Phase A)

> Phase A scope: route the affiliate niche-enhancer LLM call from the prod
> Sophia Worker → founder's M1 Max via existing `m1max-cf` Cloudflare Tunnel
> + mekongd v0 (Qwen 3.6-35B-A3B). Burn-in 1 week before any customer build.

## Prerequisites
- M1 Max with mekongd already running on `127.0.0.1:8765` (PR #86 shipped 2026-04-17)
- `m1max-cf` Cloudflare Tunnel already configured (see memory `reference_m1max_cloudflare_tunnel.md`)
- `wrangler` CLI logged into the Sophia Cloudflare account

## 1. Add tunnel ingress for mekongd
Edit `~/.cloudflared/config.yml` on M1 Max — add a new ingress rule **above** the catch-all:

```yaml
ingress:
  - hostname: mekongd.cashclaw.cc        # NEW — mekongd
    service: http://127.0.0.1:8765
  - hostname: m1max.cashclaw.cc          # existing
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Reload tunnel:
```bash
launchctl kickstart -k system/com.cloudflare.cloudflared
```

Add the DNS route (one-time):
```bash
cloudflared tunnel route dns m1max-cf mekongd.cashclaw.cc
```

## 2. Verify tunnel reaches mekongd
```bash
curl -sX POST https://mekongd.cashclaw.cc/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "Qwen/Qwen3.6-35B-A3B",
    "messages": [{"role":"user","content":"reply with 42"}],
    "max_tokens": 5,
    "stream": false
  }'
```
Expected: HTTP 200 + `{"content":[{"type":"text","text":"..."}], ...}`

## 3. Set the Sophia CF Worker secret
```bash
cd apps/sophia-ai-factory
echo 'https://mekongd.cashclaw.cc' | wrangler secret put SOPHIA_LOCAL_MEKONGD_URL
```

(Optional) bearer token for tunnel-level auth if you front mekongd with CF Access:
```bash
wrangler secret put SOPHIA_LOCAL_MEKONGD_BEARER
```

## 4. Trigger one niche-enhancer call
Hit any route that invokes `enhanceNicheScoreWithAI(...)` (admin discovery
tool or programmatic call from your existing tooling). The prod Worker will:

1. Read `SOPHIA_LOCAL_MEKONGD_URL` (now set)
2. Call mekongd via Cloudflare Tunnel
3. Emit a `byok_call` D1 signal with `provider: 'local-mekongd'`
4. Fall back to OpenRouter only if mekongd returns null

## 5. Verify telemetry in D1
```bash
cd apps/sophia-ai-factory
npx wrangler d1 execute sophia-raas-db --remote --command \
  "SELECT ts, event_type, props_json FROM signals_events
   WHERE props_json LIKE '%local-mekongd%'
   ORDER BY ts DESC LIMIT 5"
```

Expected: at least one row with `provider: 'local-mekongd'` and `status_code: 200`.

## 6. Burn-in plan (1 week)
- Daily: spot-check D1 signals for any `byok_timeout` events with `provider='local-mekongd'`
- After 7 days: pull p50/p95 latency from D1 and capture as Phase B SLO baseline
- If incidents: roll back instantly via `wrangler secret delete SOPHIA_LOCAL_MEKONGD_URL`
  → Worker reverts to OpenRouter path on the next request, zero deploy needed

## Rollback (anytime)
```bash
cd apps/sophia-ai-factory
wrangler secret delete SOPHIA_LOCAL_MEKONGD_URL
```
That single command reverts to the cloud OpenRouter path. No code change, no deploy.

## What this phase intentionally does NOT do
- No customer-facing UI, setup wizard, or enrollment flow
- No D1 schema change (per-user opt-in lives in Phase B)
- No encryption helper for stored bearer tokens (Phase C)
- No auto-installer for customer machines (Phase D)
- Health monitoring cron (Phase F)

These ship after burn-in proves the loop is stable.
