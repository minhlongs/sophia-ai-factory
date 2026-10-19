# Load Testing Runbook

This runbook covers bounded, read-only public-route probes against local development or an explicitly approved staging origin. These scripts do not exercise authenticated video creation, provider callbacks, payment mutations, queue retries, or tenant isolation; passing them is not an end-to-end video-factory or capacity proof.

## Target safety

- Production origins `sophia.agencyos.network` and `www.sophia.agencyos.network` are rejected by both the Node probe and all k6 profiles.
- Local HTTP is allowed. Remote targets must use HTTPS and require explicit acknowledgement: `SOPHIA_STAGING_LOAD_CONFIRM=run-staging-load` for Node or `K6_STAGING_CONFIRM=run-staging-load` for k6.
- Profiles inspect k6's effective merged options, including CLI overrides, and abort before sending route requests if peak VUs exceed their profile limit or total runtime exceeds 30 minutes including graceful shutdown. The stress profile is a small bounded observation run, not a capacity-to-failure test. Avoid `--no-setup`; the per-VU guard still runs before any HTTP request, but the runner may initialize the overridden VUs before aborting.
- Only run against an isolated staging environment whose owner has approved the load. Never use production data or credentials.

## k6 profiles

Install k6, then run locally:

```bash
k6 run tests/load/k6-steady.js
k6 run tests/load/k6-spike.js
k6 run tests/load/k6-soak.js
k6 run tests/load/k6-stress.js
```

Remote staging example:

```bash
K6_BASE_URL=https://staging.example.com K6_STAGING_CONFIRM=run-staging-load k6 run tests/load/k6-steady.js
```

Defaults and hard bounds:

| Profile | Default | Allowed maximum |
|---|---|---|
| Steady | 10 VU × 30s | 50 VU × 29m30s (30m total including graceful shutdown) |
| Spike | peak 10 VU, 2m total | peak 50 VU, fixed 2m |
| Soak | 5 VU × 20m | 25 VU × 29m30s (30m total including graceful shutdown) |
| Stress | peak 25 VU, fixed 6m | peak 50 VU, fixed 6m |

The shared scenario requests `/`, `/en/pricing`, `/api/health`, `/api/version`, and `/en/status`. It is read-only and does not authenticate or enqueue work.

## Node GET probe

```bash
node scripts/load-test.mjs http://localhost:3000 10 50
SOPHIA_STAGING_LOAD_CONFIRM=run-staging-load node scripts/load-test.mjs https://staging.example.com 10 50
```

Bounds are concurrency 1–50 and 1–100 requests per worker. Remote staging requires the acknowledgement shown above.

## Historical reports

Reports from May 2026 recorded public-route runs against production. They are historical observations only and are not approved procedures or current baselines. Production-target checks now reject those origins. Any new performance baseline must come from an isolated staging run and include the exact code SHA, test profile, origin class (never secrets), region, resource limits, and raw output.

## Evidence still required for full readiness

These probes alone do not prove the video-to-revenue flow. A complete staging proof also needs authenticated BYOK → provider render → MP4 verification → publish, payment success/refund/replay paths, entitlement and MCU ledger reconciliation, queue retry/DLQ recovery, cross-tenant isolation, and measured recovery behavior. Production health/SHA and 28-day unit economics are separate evidence gates; do not run stress tests against production.
