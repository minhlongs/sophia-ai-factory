# Sophia Genesis — Track B2 Compliance Publish Gate Report

**Verification Date:** 2026-11-22  
**Branch:** `feat/b2-compliance-publish-gate`  
**Base Commit (`origin/main`):** `a9214ad6df6a336f86bb010984448066eac2bba8`  
**Publication Mode:** `MOCK_ONLY` (server-enforced + SQL `CHECK`-enforced; zero external social platform calls)  
**Feature Flag Default:** `FEATURE_B2_COMPLIANCE_PUBLISH_GATE=false` (fail-closed at request time)

---

## 1. G1 Platform Policy & Provenance Compatibility Matrix

| Platform | Feature / API | Required Permission | Official Doc Source | Mocked Response Schema | Capability Status | Fail-Closed Fallback | Verified |
|---|---|---|---|---|---|---|---|
| **TikTok** | `POST /v2/post/publish/creator_info/query/` | `video.publish` | TikTok Content Posting API (`developers.tiktok.com`) | `{ data: { creator_username, privacy_level_options, max_video_post_duration_sec, comment_disabled, duet_disabled, stitch_disabled }, error: { code: "ok" } }` | `MOCK_VERIFIED` (20 req/min) | Block preflight if unavailable (`TIKTOK_CREATOR_INFO_UNAVAILABLE`) | 2026-11-22 |
| **TikTok** | `POST /v2/post/publish/video/init/` (Direct Post) | `video.publish` (audited for public) | TikTok Content Posting API — Direct Post | `{ simulatedStatus, mockReceiptId, publicUrl: null, errorCode? }` | `UNAUDITED_PRIVATE_ONLY` (6 req/min, max 5 users/24h) | Unaudited app blocks non-`SELF_ONLY` (`unaudited_client_can_only_post_to_private_accounts`); requires explicit privacy, music attestation, and forbids `brand_content_toggle=true` with `SELF_ONLY` | 2026-11-22 |
| **TikTok** | `POST /v2/post/publish/inbox/video/init/` (Draft Upload) | `video.upload` | TikTok Content Posting API — Upload Video | `{ simulatedStatus: "SIMULATED_PUBLISHED", mockReceiptId, publicUrl: null }` | `MOCK_VERIFIED` | Draft inbox fallback when `useDraftInboxFallback=true` | 2026-11-22 |
| **YouTube** | `POST /upload/youtube/v3/videos?uploadType=resumable` | `https://www.googleapis.com/auth/youtube.upload` | YouTube Data API v3 (`developers.google.com/youtube/v3`) | `{ simulatedStatus, mockReceiptId, publicUrl: null, retriable: false, errorCode? }` | `MOCK_VERIFIED` (explicit declarations required; 5xx resumable retry = `UNKNOWN`) | Require explicit `privacyStatus`, `selfDeclaredMadeForKids`, `containsSyntheticMedia`, and title; treat 400 `uploadLimitExceeded` and 403 `quotaExceeded`/`forbidden`/`forbiddenPrivacySetting` as terminal non-retriable | 2026-11-22 |
| **Instagram** | `POST /{ig-user-id}/media` → `GET /{id}?fields=status_code` → `POST /{ig-user-id}/media_publish` | `instagram_content_publish` (Business/Creator only; Facebook Login for branded content) | Meta Instagram Platform — Content Publishing (`developers.facebook.com`) | `{ simulatedStatus, mockReceiptId, publicUrl: null, errorCode? }` | `MOCK_VERIFIED` (conservative 50/24h cap; Meta docs note 100/24h vs 50/24h carousel) | Block `PERSONAL` accounts, unready containers, `branded_content_sponsor_ids` without Facebook Login, >2 sponsors, self-tag, or close-friends-only | 2026-11-22 |
| **Inngest** | `step.waitForEvent(id, { event, timeout, if })` | Installed `inngest@^3.50.0` | Inngest TypeScript SDK v3 | `event \| null` (72h timeout) | `EXISTING_AND_TESTED` | On `null` timeout → `APPROVAL_EXPIRED`; always re-read D1 `b2_publish_gate_requests` as source of truth; ignore forged wake-up events | 2026-11-22 |

---

## 2. G0 Capability Reconciliation Summary

| Capability | Status | Disposition in B2 |
|---|---|---|
| Existing `publish_ledger` & `/api/publish-approvals` | `EXISTING_AND_TESTED` | Preserved untouched; no destructive mutation or parallel overwrite. |
| `parseCreatorInfoResponse()` (`src/tree/social/publisher/tiktok-creator-info-types.ts`) | `EXISTING_AND_TESTED` | Reused inside `tiktok-mock-adapter.ts` via safe `unwrapOkErrorForParser()` wrapper. |
| Auth (`getCurrentUser`), Workspace RBAC (`verifyWorkspaceAccess`, `verifyWorkspaceRole`), CSRF (`verifyCsrfToken`) | `EXISTING_AND_TESTED` | Reused directly in `/api/publish-gate` and `handlePublishGatePost`. |
| Inngest v3 Client & Serve Route (`src/seed/inngest/`, `src/app/api/inngest/serve/core-functions.ts`) | `EXISTING_AND_TESTED` | Extended additively with `campaign/publish.gate_requested`, `campaign/publish.human_approved`, and `b2PublishGateWorkflowFunction`. |
| 12-State Compliance Publish Gate Ledger (`0516_b2_compliance_publish_gate.sql`) | `MISSING` → **IMPLEMENTED** | Additive D1 tables `b2_publish_gate_requests` + `b2_publish_gate_events` with `MOCK_ONLY` and 12-state SQL `CHECK` constraints. |
| Deterministic Zero-Network Mock Adapters (TikTok, YouTube, Instagram) | `MISSING` → **IMPLEMENTED** | Implemented under `src/tree/publish-gate/adapters/` with 0 network calls. |
| Bilingual EN/VI Compliance Review & Approval UI (`/dashboard/publish-gate`) | `MISSING` → **IMPLEMENTED** | Implemented with Zen Design OS semantic tokens and `messages/en.json` + `messages/vi.json`. |

---

## 3. G9–G11 Benchmarks, Cost & Operational Profile

| Metric | Measured Value | Notes |
|---|---|---|
| **External Network Calls** | `0` | Enforced by global `fetch` tripwire across all 45 Vitest cases; mock adapters are pure deterministic functions. |
| **Paid AI / Platform API Spend** | `$0.00` | Zero live inference, zero real OAuth/upload calls, zero payment activation. |
| **45-Test B2 Suite Execution Time** | `2.39s` total (`3.45s` test CPU across 4 files) | Includes in-memory and on-disk multi-isolate SQLite D1 tests. |
| **15-Step Multi-Isolate Journey Latency** | `< 450ms` end-to-end (including Worker restart over SQLite file) | Covers flag-off, unauth, blocked preflight, mutation, pass preflight, submit, restart, IDOR, bad nonce, bad digest, approve, replay, execute, idempotent replay. |
| **D1 Operations per Full Happy Path** | `~10` lightweight indexed statements (`create`, `preflight`, `submit`, `approve`, `claim`, `finalize` + append-only audit rows) | Well within Cloudflare D1 free/standard row-read/write budgets. |
| **OpenNext Worker Bundle Impact** | `deploy:build` PASS (`.open-next/worker.js` `15,450` bytes entry wrapper) | No new runtime dependencies added; zero Mastra/LangGraph/CrewAI added. |
| **Production Impact** | `ZERO` | Isolated Draft PR only; `FEATURE_B2_COMPLIANCE_PUBLISH_GATE=false` default; no production migrations or deploys executed. |
