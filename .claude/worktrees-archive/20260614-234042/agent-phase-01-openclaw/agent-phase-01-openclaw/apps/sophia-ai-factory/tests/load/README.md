# k6 Load Testing — Sophia AI Factory

4 profiles for different scaling questions. All hit public routes only (no auth, no DB writes).

## Install k6

```bash
brew install k6
# or: docker pull grafana/k6:latest
```

## Profiles

| Profile | VUs | Duration | Question | SLO |
|---|---|---|---|---|
| `k6-steady.js` | 50 | 10m | Baseline latency under daily load | p95 < 500ms, errors < 1% |
| `k6-spike.js` | 0→500 | 30s ramp + 1m hold | Autoscale absorbs burst? | p95 < 2s, errors < 2% |
| `k6-soak.js` | 100 | 20m–2h | Memory leak / drift over time | p95 drift < 20% |
| `k6-stress.js` | 0→2000 | 6m ramp | Find breakpoint | observation-only |

## Run

```bash
# Local dev server (must be running: npm run dev)
K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-steady.js

# Against production (READ-ONLY routes, but check cost first)
K6_BASE_URL=https://sophia.agencyos.network K6_VUS=20 k6 run tests/load/k6-steady.js

# Against staging fork (preferred for stress)
K6_BASE_URL=https://staging-fork.example.com k6 run tests/load/k6-stress.js
```

## Routes Covered

All 5 routes hit per iteration (see `scenarios/public-routes.js`):
- `GET /`
- `GET /en/pricing`
- `GET /api/health`
- `GET /api/version`
- `GET /en/status`

## Adding Auth-Protected Routes

Currently public-only. To add auth-protected scenarios:
1. Provision test user via Better Auth admin API (signed session cookie required).
2. Pass cookie via `__ENV.K6_AUTH_COOKIE` and inject into `params.cookies`.
3. Use idempotent endpoints only (avoid creating real videos / charges).

## CI Integration (future)

GitHub Actions disabled (CF-direct doctrine). Run locally pre-deploy:
```bash
# Pre-deploy gate (manual)
npm run build && K6_DURATION=2m k6 run tests/load/k6-steady.js
```

## Output

k6 prints summary at end. To export:
```bash
k6 run --out json=results.json tests/load/k6-steady.js
k6 run --out csv=results.csv tests/load/k6-steady.js
```

## Anti-Patterns

- ❌ Running stress on production (real $$ cost + customer impact)
- ❌ Mixing auth + public scenarios in same file
- ❌ Hitting POST/PUT routes (creates real DB rows)
- ❌ Running soak < 20m (not enough to surface drift)
