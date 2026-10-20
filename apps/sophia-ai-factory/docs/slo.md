# Service Level Objectives (SLOs)

This document defines the production targets and the evidence required to claim them. A target is not a measured result.

## Targets

| SLI | Target | Window |
| --- | --- | --- |
| API availability | ≥ 99.9% successful responses | Rolling 30 days |
| API latency | p95 < 500 ms | Rolling 30 days |
| API server errors | < 0.1% 5xx responses | Rolling 30 days |
| Video completion rate | ≥ 90% of eligible video jobs reach a completed state | Rolling 30 days |
| Video completion time | p95 ≤ 600 s (render stage) | Rolling 30 days |

Availability is `eligible successful requests / eligible requests`. Exclude static assets and explicitly list excluded routes. Define success as HTTP 2xx or 3xx; server errors are HTTP 5xx. The report must include denominators, route scope, time boundaries in UTC, and the full deployed SHA. A job accepted or queued is not a completed video job.

### Why these two video numbers, and not the API numbers

The API SLOs above say the control plane is healthy; they say nothing about whether a
customer's video arrives. Video completion is the product promise, so it gets its own SLI.

A video job is **eligible** when it was accepted with usable customer BYOK credentials and
no provider-side rejection. It is **completed** when the job row reaches a terminal success
state *and* the resulting MP4 is retrievable and decodable — an accepted or queued job, a
provider `failed` job, and a `failed_permanent` row are all non-completions, and each is
reported separately so a rising completion rate cannot hide a rising failure count.

**Completion time** is measured from `videos.created_at` to `videos.completed_at` and is
reported as a percentile over eligible jobs. The **p95 ≤ 600 s** target is anchored to the
customer copy, which breaks a "under 40 minutes" video into named steps:

| Copy step | Minutes |
|---|---:|
| Script generation | 5 |
| **AI video generation** | **10** |
| Voice-over | 3 |
| Editing | 15 |
| Upload | 5 |
| **Whole flow** | **40** |

Only the 10-minute row is the render stage this SLI measures, so 600 s is the number the
copy actually commits to for that step.

### Two thresholds that must never be conflated

The repository carries both numbers, and they mean different things:

| Constant | Value | Meaning |
|---|---:|---|
| `RENDER_STAGE_THRESHOLD` (`video-render-benchmark-types.ts`) | 600 s | AI-video render step — the SLI target |
| `PROMISE_THRESHOLD` (same file) | 2400 s | the whole-flow promise the customer copy makes |

`PROMISE_THRESHOLD` is **intentionally 2400 s** and must not be changed to tighten the
SLI: it encodes a public promise covering scripting, voice-over, editing, and upload.
`percent_under_promise` answers "did we keep the whole-flow promise"; the new p95 target
answers "did the render step stay inside its 10-minute share". A render that consumed the
whole 40-minute budget would pass the first check and fail the second, which is why both
exist.

The 900 s provider ceiling (`SOPHIA_LIVE_VIDEO_TIMEOUT_SECONDS`, and `maxWaitMs = 15 min`
in `heygen-helpers.ts`) is neither of these — it is the operational bound at which the
provider is declared unresponsive. Three numbers, three purposes:

- **600 s** — quality target for the render step.
- **900 s / 15 min** — provider declared unresponsive.
- **2400 s** — whole-flow promise to the customer.

An earlier revision of this document declared a single `p95 ≤ 300 s` figure derived from
provider render copy. That was wrong: it matched neither the render component of the
customer promise nor any existing constant. It is corrected here rather than quietly
changed.

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
