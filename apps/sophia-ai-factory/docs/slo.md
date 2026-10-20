# Service Level Objectives (SLOs)

This document defines the production targets and the evidence required to claim them. A target is not a measured result.

## Targets

| SLI | Target | Window |
| --- | --- | --- |
| API availability | ≥ 99.9% successful responses | Rolling 30 days |
| API latency | p95 < 500 ms | Rolling 30 days |
| API server errors | < 0.1% 5xx responses | Rolling 30 days |
| Video completion rate | ≥ 90% of eligible video jobs reach a completed state | Rolling 30 days |
| Video completion time | p95 ≤ 300 s from accepted job to first playable MP4 | Rolling 30 days |

Availability is `eligible successful requests / eligible requests`. Exclude static assets and explicitly list excluded routes. Define success as HTTP 2xx or 3xx; server errors are HTTP 5xx. The report must include denominators, route scope, time boundaries in UTC, and the full deployed SHA. A job accepted or queued is not a completed video job.

### Why these two video numbers, and not the API numbers

The API SLOs above say the control plane is healthy; they say nothing about whether a
customer's video arrives. Video completion is the product promise, so it gets its own SLI.

A video job is **eligible** when it was accepted with usable customer BYOK credentials and
no provider-side rejection. It is **completed** when the job row reaches a terminal success
state *and* the resulting MP4 is retrievable and decodable — an accepted or queued job, a
provider `failed` job, and a `failed_permanent` row are all non-completions, and each is
reported separately so a rising completion rate cannot hide a rising failure count.

**Completion time** is measured from the moment the job was accepted to the timestamp of
the first playable artifact, and is reported as a percentile over eligible jobs. The
**p95 ≤ 300 s** number is anchored to two things that already exist in the system:

- the customer-facing copy states render depends on the provider but is "usually 2–5
  minutes", so 300 s is the upper edge of the range we tell customers to expect;
- `src/land/video/templates/heygen-helpers.ts` polls for up to
  `maxWaitMs = 15 * 60_000`, and the live video proof uses
  `SOPHIA_LIVE_VIDEO_TIMEOUT_SECONDS` defaulting to 900 s.

That makes 300 s a *quality* target, distinct from the 900 s *operational* ceiling at which
we declare the provider unresponsive. If p95 exceeds 300 s while still succeeding, the
promise to customers is being broken even though nothing failed — which is exactly the case
an API SLO cannot see.

**Completing the measurement needs collection this repository does not yet have.** These are
**targets, not results.** No measured value is claimed here, and none may be inferred from a
green CI run or a passing live proof — both exercise single jobs, not a 30-day distribution.

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
