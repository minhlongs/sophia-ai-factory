# Factory + Edge Tracking Implementation Report
**Date:** 2026-05-03

---

## Part A: URL-to-Revenue Orchestrator

**Files (LOC)**
- `src/lib/factory/url-product-extractor.ts` — 100 LOC. Workers-safe regex HTML extractor (no external deps). Reads first 100KB, extracts og:/twitter:/JSON-LD metadata.
- `src/lib/factory/url-to-revenue.ts` — 165 LOC. Core orchestrator. Validates request, extracts product info, persists to D1, queues Inngest events per variant.
- `src/app/api/v1/factory/url-to-revenue/route.ts` — 55 LOC. POST endpoint with Zod validation + getCurrentUser() auth.
- `src/app/api/v1/factory/url-to-revenue/[jobId]/route.ts` — 45 LOC. GET status with tenant isolation.
- `src/lib/factory/__tests__/url-to-revenue.test.ts` — 80 LOC. 8 tests.

**Tests:** 8/8 pass.

**Inngest integration status:** PARTIAL (documented TODO).
- Existing `video.requested` event + `videoScripting` function are wired and handle OpenRouter script generation.
- `dispatchVideoRequested()` in orchestrator is a stub that logs the intent. Needs a new Inngest event `url_revenue.video.requested` (or param on existing) to differentiate URL-sourced vs direct-prompt jobs.
- Why deferred: connecting locale/channel parameters into the existing scripting→TTS→compose→upload→publish chain requires extending the video job schema — out of scope for this PR. Orchestrator ships; job state is persisted; chain wiring = Phase B task.

**Migration:** `0081-url-to-revenue-jobs.sql` — 1 table, 2 indexes.

---

## Part B: Edge Tracking S2S Postback

**Files (LOC)**
- `src/lib/tracking/edge-link.ts` — 155 LOC. Core: `createTrackingLink`, `recordClick`, `recordConversion`, `getTrackingLink`. Base62 ID gen via Web Crypto. IP hashing sha256(ip+tenant_secret).
- `src/app/api/track/[id]/route.ts` — 40 LOC. 302 redirect + click recording (moved from /api/r/[id] to avoid route ambiguity).
- `src/app/api/v1/tracking/links/route.ts` — 85 LOC. POST create + GET list (tenant-scoped).
- `src/app/api/v1/tracking/links/[id]/route.ts` — 65 LOC. GET detail with click count + DELETE (soft).
- `src/app/api/postback/[network]/route.ts` — 75 LOC. Generic S2S receiver. Allowlist: binance-link, bybit, bitget, okx, partnerstack, impact, cj, awin, generic.
- `src/lib/tracking/tracking-README.md` — DNS subdomain setup, Wrangler routes config, S2S postback URL format per network.
- `src/lib/tracking/__tests__/edge-link.test.ts` — 145 LOC. 9 tests.

**Tests:** 9/9 pass.

**DNS subdomain TODO:** `track.sophia.agencyos.network` requires manual Cloudflare DNS CNAME + Wrangler route config. Documented in tracking-README.md.

**Postback signature verification TODO:** HMAC verification per network (Binance/Bybit/PartnerStack signatures) not yet implemented. Flagged with TODO comment and `POSTBACK_SIGNATURE_VERIFICATION_ENABLED` env var gate.

**Migration:** `0082-edge-tracking.sql` — 3 tables (tracking_links, tracking_clicks, tracking_conversions), 4 indexes.

---

## Migrations Summary

| File | Status |
|---|---|
| `migrations/0081-url-to-revenue-jobs.sql` | Created (needs `npx wrangler d1 execute sophia-raas-db --file=migrations/0081-url-to-revenue-jobs.sql --remote`) |
| `migrations/0082-edge-tracking.sql` | Created (needs same apply) |
| `migrations/0080-affiliate-scoring.sql` | Coordinated — owned by scoring/geo agent |

---

## TypeScript Check

`npx tsc --noEmit` → 0 errors in new files. Pre-existing error in `zalo-publisher.ts` (unrelated, was there before).

---

## Skipped / Deferred

- Full Inngest chain wiring for URL→video pipeline: deferred. Orchestrator + DB persistence ship now; render/TTS/publish chain extension = separate task.
- Network-specific postback HMAC: deferred. Documented with TODO + env flag.
- DNS subdomain provisioning: infrastructure step, documented in tracking-README.md.
