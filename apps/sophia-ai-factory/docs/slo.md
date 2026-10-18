# Service Level Objectives (SLOs)

This document defines the production targets and the evidence required to claim them. A target is not a measured result.

## Targets

| SLI | Target | Window |
| --- | --- | --- |
| API availability | ≥ 99.9% successful responses | Rolling 30 days |
| API latency | p95 < 500 ms | Rolling 30 days |
| API server errors | < 0.1% 5xx responses | Rolling 30 days |
| Video generation | Use the declared completion-rate and completion-time targets in the production evidence report | Same window |

Availability is `eligible successful requests / eligible requests`. Exclude static assets and explicitly list excluded routes. Define success as HTTP 2xx or 3xx; server errors are HTTP 5xx. The report must include denominators, route scope, time boundaries in UTC, and the full deployed SHA. A job accepted or queued is not a completed video job.

## Current evidence status

**Production SLOs are unverified until a raw, source-bound Cloudflare export covers at least 28 days on the approved deployed SHA.** The target values above are not evidence that production currently meets them.

The repository currently has an isolate-local ring buffer in `src/seed/observability/telemetry/metrics.ts`. `/api/metrics` reads that buffer; it is not a durable 28-day history. The optional Workers Analytics Engine writer is not yet configured as a `WAE` binding in `wrangler.toml`. The current middleware sample is recorded before downstream route handlers finish, so its duration does not establish full API handler latency. Do not use these values as production request latency or a rolling SLO until collection is wired and validated end to end.

Older Honeycomb dashboard/runbook instructions are historical optional integrations. Honeycomb is not required by the no-tech doctrine and must not be treated as an active canonical SLO source without current evidence.

## Cloudflare-native evidence path

Use Cloudflare Workers metrics/Analytics Engine, with a configured Worker binding and bounded-cardinality fields for route template, method, status class, duration, and environment. Do not include user IDs, API keys, prompt text, video URLs, or other customer data in metric dimensions. Validate the actual production binding and write/read path before starting the 28-day measurement window.

Workers Logs are useful for incident investigation, but their retention is limited (3 days on Free and 7 days on paid plans), so logs alone cannot establish a 28-day SLO. Workers Analytics Engine retains queryable data for up to 3 months and can support a 28-day window when configured and populated. See [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Workers metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/), and [Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/).

If exports must be captured as files, preserve each raw export in an access-controlled location, compute its SHA-256, record the query and UTC window, and keep the approved deployment SHA with it. The business-flow verifier binds summary JSON to source-file hashes but does not independently authenticate Cloudflare origin or recompute metrics from raw rows; the calculation remains operator-attested.

## Alerts and review

- Alert on sustained 5xx/error-budget burn and video completion failures using Cloudflare-native telemetry and the existing platform alert path.
- Review weekly; report the 28-day SLI, denominator, error-budget burn, unresolved P0/P1 count, and any data gaps.
- A monitoring gap or missing denominator makes the SLO **unknown**, not passed.

## Claiming a pass

Only claim a production SLO pass when the evidence includes:

1. The approved full deployment SHA, matching the live `/api/version` SHA.
2. A raw Cloudflare export for one common UTC window of at least 28 days.
3. Route scope, denominators, API availability, p95 latency, and 5xx rate computed from completed request observations.
4. Video job counts, completion rate, and completion-time percentile from durable job records.
5. Zero unresolved P0/P1 incidents in the same window.
6. The raw-export SHA-256 and the calculation summary, saved with the business-flow proof.
