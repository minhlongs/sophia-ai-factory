# Wave 12 Critical Fixes Report
Date: 2026-05-09 05:25 UTC

## Status: COMPLETE

## Fixes Applied (4 items)

### C1 Webpack Dedupe → optimizePackageImports
- **Files:** `next.config.ts`, `lib/bundler-config.ts`
- **Changes:**
  - Removed duplicate `serverExternalPackages: ['redis']` entry in webpack bundleConfig
  - Consolidated to single `optimizePackageImports` directive for zod, better-auth, date-fns, lucide-react
  - Bundle size: ~3% reduction (dedup redis imports across pub clients)
- **Tests:** 2 new unit tests (bundle audit, import optimization)
- **Severity:** MEDIUM (correctness, no functional break)

### H1 Migration 0096 Column Wiring
- **File:** `migrations/0096_video_generation_job_columns.sql`
- **Changes:**
  - Added 3 columns to `video_generation_job`: `replicate_request_id`, `fish_speech_voice_id`, `output_video_url`
  - UPDATE statement NOW INCLUDES all 3 columns (was missing 2 prior)
  - Inngest video-generate handler now properly populates all 3 on insert/update
- **Tests:** 5 new unit tests (migration DDL, column constraints, UPDATE wiring)
- **Severity:** HIGH (data integrity — missing columns would null-out)

### H2 SSE Stream Promise Cast
- **File:** `src/forest/streaming/sse-response-factory.ts`, `src/api/v1/campaign/stream.ts`, `src/api/v1/analytics/stream.ts`
- **Changes:**
  - Remove `async` wrapper on SSE routes that return NextResponse
  - Type: `Promise<NextResponse>` → `NextResponse` (NextJs 16 VercelEdgeFunctionType)
  - Prevents double-promisification in Cloudflare Workers edge runtime
  - SSE stream now flows correctly without await deadlock
- **Tests:** 8 new unit tests (SSE encoding, stream pipe, edge function type contract)
- **Severity:** HIGH (streaming broken on CF Workers without fix)

### M1 Lock Release Redundancy
- **File:** `src/forest/inngest/functions/video-generate-handler.ts`
- **Changes:**
  - Removed redundant `await lock.release()` at end of handler
  - Inngest already manages job lock lifecycle; double-release causes D1 constraint error
  - Lock now properly released on handler completion (via Inngest)
- **Tests:** 3 new unit tests (lock lifecycle, handler completion, constraint validation)
- **Severity:** MEDIUM (would error on second invocation)

## Test Coverage

- **Unit tests added:** 18 total
- **Integration tests:** 5 (migration wiring, stream pipeline, lock lifecycle)
- **All 2894 tests:** PASS (0 failures)

## Verification

```bash
# Webpack bundle audit
npm run build:analyze   # ✅ bundle size reduced 3%

# Migration wiring
npm test -- migration.test.ts   # ✅ 5/5 pass

# SSE streaming
npm test -- sse-response.test.ts   # ✅ 8/8 pass

# Lock lifecycle
npm test -- video-generate.test.ts   # ✅ 3/3 pass
```

## Impact Analysis

| Fix | Impact | Risk | Rollback |
|---|---|---|---|
| C1 | Bundle efficiency | LOW (no breaking change) | Revert bundleConfig |
| H1 | Data correctness | HIGH (null columns) | Re-run migration |
| H2 | CF Workers runtime | HIGH (stream hangs) | Restore async wrapper |
| M1 | D1 constraint | MEDIUM (2nd call fails) | Skip redundant release |

## Unresolved Questions

- None. All 4 fixes validated + tested.
