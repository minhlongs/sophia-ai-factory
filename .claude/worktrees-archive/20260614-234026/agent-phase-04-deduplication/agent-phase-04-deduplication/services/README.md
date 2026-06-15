# Sophia Compute Services

Off-edge compute for video generation. The Cloudflare Worker (`apps/sophia-ai-factory/`) orchestrates these via internal API routes (`/api/internal/{tts,runpod-trigger,runpod-status}`).

## Topology

```
CF Worker (edge, sin/iad/...)        Fly.io (sin primary)            Runpod (per-region)
─────────────────────────             ────────────────                ─────────────────
/api/internal/tts ─────HTTPS────►   sophia-coqui-tts            
/forest/inngest/video-* ────────►   sophia-moviepy-render       
/api/internal/runpod-trigger ───────────────────────────HTTPS───►   serverless A100 80GB
/api/internal/runpod-status (poll) ─────────────────────HTTPS───►   serverless A100 80GB
```

| Service | Path | Runtime | Region | Workload |
|---|---|---|---|---|
| `coqui-tts` | `services/coqui-tts/` | Fly.io shared-cpu-2x / 4GB | `sin` (primary) | XTTS voice synthesis |
| `moviepy-render` | `services/moviepy-render/` | Fly.io shared 4 cpus / 4GB | `sin` (primary) | Path A template video composition |
| `runpod-hunyuan` | `services/runpod-hunyuan/` | Runpod serverless A100 80GB | per-region | Path B cinematic video (HunyuanVideo 1.5 FP8) |

## Tier Routing

Per `apps/sophia-ai-factory/src/lib/video/visual-router.ts`:

- `free | pro` → MoviePy template path (~$0.20–0.50 / video, < 60s)
- `enterprise` → HunyuanVideo cinematic on Runpod (~$5–15 / video, < 8min)

Per-stage cost recorded by `src/lib/video/cost-ledger.ts` into `video_cost_log` and aggregated on `video_jobs.cost_usd`.

---

## Deploy: First Time

```bash
# 1) Coqui TTS
cd services/coqui-tts
fly launch --no-deploy --copy-config --name sophia-coqui-tts
fly secrets set HF_TOKEN=... XTTS_MODEL=v2
fly deploy

# 2) MoviePy Render
cd ../moviepy-render
fly launch --no-deploy --copy-config --name sophia-moviepy-render
fly deploy

# 3) Runpod Hunyuan (handler.py)
# Build image with HunyuanVideo deps + handler.py (see services/runpod-hunyuan/README.md)
# Push to Runpod registry, create Serverless endpoint
# Set env on the CF Worker:
#   wrangler secret put RUNPOD_API_KEY
#   wrangler secret put RUNPOD_ENDPOINT_ID
```

---

## Add Regions (Phase 06 multi-region — defer until 1 paying customer demands HQ video)

Both Fly services declare `primary_region = "sin"`. To add additional regions:

```bash
# Coqui TTS — add iad + fra (latency-based routing is automatic)
cd services/coqui-tts
fly regions add iad fra
fly scale count 1 --region iad
fly scale count 1 --region fra

# MoviePy Render — keep scale-to-zero so cold cost stays $0
cd ../moviepy-render
fly regions add iad fra
# Do NOT pin min-machines > 0 unless cold-start dominates p95.
```

Verify replication:
```bash
fly status -a sophia-coqui-tts        # check 1 machine per region
fly logs -a sophia-coqui-tts -r iad   # tail logs from a specific region
```

---

## Common Operations

### Tail logs

```bash
fly logs -a sophia-coqui-tts
fly logs -a sophia-moviepy-render
```

### Restart

```bash
fly machine restart -a sophia-coqui-tts <machine_id>
```

### Scale resources

```bash
fly scale memory 8192 -a sophia-coqui-tts            # bump memory
fly scale vm shared-cpu-4x -a sophia-moviepy-render  # bump CPU class
```

### Cost ceiling

Fly: dashboard shows monthly spend per app. Set hard limit via `fly orgs limit set`.
Runpod: per-job cost recorded in `cost-ledger.ts`. Aggregate query:

```sql
SELECT provider, SUM(cost_usd) FROM video_cost_log
WHERE recorded_at > strftime('%s','now','-30 days')
GROUP BY provider;
```

---

## Health & Alerts

- Coqui TTS: `GET /health` checked every 15s by Fly load balancer (see `fly.toml`).
- MoviePy: scale-to-zero, no continuous health check.
- Runpod: poll `/api/internal/runpod-status?jobId=...` from Inngest steps. No webhook (currently polling — switch to webhook is a Phase 06 follow-up).

CF Worker uptime cron (`/api/cron/uptime-check`) does not currently probe Fly endpoints. To add:

```ts
// In src/app/api/cron/uptime-check/route.ts, append:
const flyEndpoints = [
  'https://sophia-coqui-tts.fly.dev/health',
];
// Ping each, alert via existing alertAdmin() if non-200.
```

---

## Anti-Patterns

- ❌ Removing `auto_stop_machines = true` on MoviePy without reason → bill goes from ~$0 to ~$30/mo
- ❌ Pinning `min_machines_running > 0` on Coqui multi-region without paying customer demand → 3× the cost for 0 customer benefit
- ❌ Deploying Runpod handler from local without committing handler.py first — production divergence
- ❌ Calling `/api/internal/*` from the public surface — all `internal/` routes assume Inngest-only callers

---

## Defer Until Revenue (per Phase 06 plan)

- Multi-region rollout → wait for 1 paying customer demanding HQ video OR > 100 concurrent jobs
- Wireguard mesh between Worker ↔ Fly → public HTTPS + auth is fine until then
- R2 storage lifecycle policies → trivial cost at current volume
- Runpod webhook (replacing polling) → polling works; switch only if Inngest cost dominates
