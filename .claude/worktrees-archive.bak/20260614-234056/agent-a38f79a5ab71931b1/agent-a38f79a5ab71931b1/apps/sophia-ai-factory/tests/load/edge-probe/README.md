# Edge-Region Latency Probe

Standalone Cloudflare Worker that times sequential fetches against Sophia
production from inside CF's network. Separates network jitter (PT origin →
CF edge) from app cost (CF edge → CF Worker → R2/D1).

## Why
The k6 baseline runs from PT and dominates p95 with network latency. This
probe runs inside CF infra, so its timings reflect app cost only.

## Deploy

```bash
cd tests/load/edge-probe
npx wrangler deploy
```

Wrangler will print the deployed URL, e.g.:
```
https://sophia-edge-probe.<account-subdomain>.workers.dev
```

## Run

```bash
curl -s "https://sophia-edge-probe.<account-subdomain>.workers.dev/?n=20" | jq
```

`n` clamps to [1, 50]. Each iteration hits all 5 routes sequentially.

## Tear down

```bash
npx wrangler delete sophia-edge-probe
```

## Response shape

```json
{
  "target": "https://sophia.agencyos.network",
  "iterations": 20,
  "colo": "SIN",
  "startedAt": "2026-05-11T05:40:00Z",
  "finishedAt": "2026-05-11T05:40:18Z",
  "stats": [
    {
      "name": "homepage",
      "path": "/",
      "count": 20,
      "okCount": 20,
      "min": 42,
      "avg": 87,
      "p50": 78,
      "p95": 145,
      "max": 198
    }
    // ... 4 more routes
  ]
}
```

Compare `p95` to the k6 PT baseline to estimate what fraction of latency is
network jitter vs app cost.
