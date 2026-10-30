# Runtime map — approval lifecycle + render + legacy postback

Baseline: `e9147a1b` (main = live, 2026-10-30). Không browser; chỉ CLI/gh/tests.

## 1. Approval lifecycle hiện có

| Thành phần | File | Trạng thái |
|---|---|---|
| UI approvals | `src/app/[locale]/dashboard/approvals/page.tsx` + `src/components/approval-queue/` | Đọc `GET /api/approvals` (bảng `agent_approvals` qua `agent_runs`), resolve qua `PATCH /api/approvals/[id]`; auth session + `hasWorkspaceRole(..., 'ADMIN')` |
| Repo OPC campaign approval | `src/tree/affiliate/approval/campaign-approval-repo.ts` | `create/get/invalidate/approve` trên `agent_campaign_approvals`; `approveCampaignApproval` 0 caller prod |
| Guard | `src/tree/affiliate/approval/campaign-approval-guard.ts` | `buildCampaignApprovalPayload` + `verifyCampaignApprovalIntegrity` (tenant/campaign/niche/jurisdiction/hash/cost/status/re-run eligibility) |
| Dispatcher | `src/forest/inngest/functions/niche-video-campaign-dispatcher.ts` | fail-closed 12 gate; draft `DRAFT_PENDING_CEO_APPROVAL` (persist pending row); gate path cần `approvalId` + `approvalHash` + `termsVerified=true` |
| Run repo | `src/tree/affiliate/execution/execution-repo.ts` | `beginExecutionRun` (idempotency ON CONFLICT) + `transitionRun` whitelist |
| Bảng | `migrations/0482_opc_affiliate_execution_truth.sql` | `agent_campaign_approvals` (pending_ceo/approved/invalidated, KHÔNG có payload/expiry/revoke/executed), `affiliate_execution_runs` (KHÔNG có provider_job_id), `affiliate_media_artifacts` (storage_key + sha256 + is_fixture) |
| Telegram | `src/land/social/telegram/handlers/campaign-approval.handler.ts` | draft-only, không tenant; nút approve/revoke CHƯA có handler |

Thiếu: (a) payload + dispatch context không persist → UI/server không thể re-verify hay tiếp tục; (b) không expiry/revoke/reject/executed; (c) approve CAS + continuation event không tồn tại; (d) không recovery path cho approved-nhưng-chưa-chạy.

## 2. Render pipeline hiện có

- Canonical: `src/land/video/generation/render-byok-video.ts` — HeyGen BYOK (`createHeyGenVideo` + `pollHeyGenStatus` tại `land/video/templates/heygen-helpers.ts`, circuit breaker + timeout), fire-and-forget, ghi bảng `videos` (0024, user-scoped, KHÔNG tenant-scoped).
- Poller khác: `generate-campaign-video-poller.ts` (blocking sleep loop), `seed/ai/video-generator.ts` (checkVideoGenerationStatus).
- `affiliate_media_artifacts`: writer (`artifact-verifier.ts` trong land/video? — cần xác nhận khi implement), publisher đọc `verifiedArtifactForRun`, `is_fixture`/`isFixtureVideoUrl` tách fixture khỏi prod.
- Storage: R2 binding `VIDEO_BUCKET` (sophia-videos) tồn tại trong wrangler; `seed/r2/bucket-ops.ts` chỉ có dead-letter helpers. Chưa có put/get video + checksum từ bytes thật.
- Media validation: không ffprobe trong sandbox; dùng size + sha256 + magic bytes + provider metadata.

## 3. Legacy postback hiện có

- Legacy A: `src/app/api/webhooks/saas-crypto/[network]/route.ts` — HMAC global env + fail-loud 401/503 (PR #72), mapping khách hàng `body.affiliate_id/sub_id` TRUST (nguy hiểm), secret rỗng.
- Legacy B: `src/app/api/webhooks/affiliate/[network]/route.ts` + colocated `affiliate-network-configs.ts` — Refer Sophia ledger, HMAC per-network, không tenant.
- Canonical: `src/app/api/postback/[network]/` → `processSaasCryptoPostback` (Domain B): per-tenant secret, server-side mapping `tracking_links`, idempotent.
- Guide pillar vẫn publish cả 2 URL legacy. Production usage: UNKNOWN (không observability prod).

## 4. Quyết định kiến trúc (khóa)

- A1. Approval stream 1: mở rộng `agent_campaign_approvals` (payload_json, dispatch_json, expires_at, revoked_*, executed_at, rejection_reason) + repo CAS + server route `/api/campaign-approvals/[id]` (mirror `/api/approvals/[id]`) + section mới TRÊN page approvals hiện có (không dashboard song song) + dispatcher nhận payload/context + approve→continuation `niche.video.campaign.requested` (idempotency key xác định) + resume recovery.
- A2. Render stream 2: Inngest worker `execution.render.requested` → adapter HeyGen (submit/poll qua API có key, KHÔNG fetch URL tùy ý từ callback) → bytes → R2 VIDEO_BUCKET key `tenantId/...` → sha256/size/magic verify → `recordVerifiedArtifact`; reserved/actual, failure states thật; fixture chỉ trong test có nhãn.
- A3. Postback stream 3: legacy A giữ HMAC global (authenticity) + resolve tenant CHỈ qua server-side `tracking_links` mapping (dùng lại Domain B); unattributable→dead-letter bền vững + 200 có nhãn; transient→503; invalid→401/400; secret-missing→500. Legacy B giữ nguyên hành vi Refer Sophia + docs. Không xóa endpoint, không tự đặt sunset.
