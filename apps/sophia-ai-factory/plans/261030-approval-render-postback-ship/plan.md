# Plan — approval lifecycle + render + legacy postback (`--ship`)

Ngày: 2026-10-30. Branch: `arena/3feabac4-sophia-ai-factory` @ `e9147a1b`.
Nguyên tắc: tái dùng UI/repo/actions/jobs hiện có; không dashboard song song; không provider/framework mới;
prod path không fixture; tiền thật giám sát qua trạng thái thật; thiếu quyền/provider → BLOCKED/NOT VERIFIED.

## PR1 — Approval lifecycle (agent_campaign_approvals → continuation)

1. Migration `0485`: `payload_json`, `dispatch_json`, `expires_at`, `revoked_at/by`, `executed_at`,
   `rejection_reason`, index `(tenant_id, status)`.
2. Repo: create persist payload+dispatch+expiry; `approveCAS` (winner duy nhất), `rejectApproval`,
   `revokeApproval`, `markExecuted`, `listTenantApprovals`, `findStuckApproved` (recovery).
3. Guard: verify thêm expiry/revoke/executed + hash(payload_json).
4. Route `PATCH /api/campaign-approvals/[id]` (approve/reject/revoke/resume): session + ADMIN,
   server re-verify offer terms từ dispatch_json.offerId, approve→CAS→`inngest.send`
   continuation `niche.video.campaign.requested` (cùng idempotency key xác định).
5. Dispatcher: draft persist payload+dispatch; sau `beginExecutionRun` thành công → `markExecuted`
   (best-effort); guard chấp nhận row mới.
6. UI: section campaign approvals trên page hiện có + nút approve/reject/revoke/resume + i18n VI/EN.
7. Telegram: giữ draft-only; nút inline KHÔNG wire (chưa có tenant auth) — ghi NOT VERIFIED.

## PR2 — Render worker + artifact verification

1. Inngest `execution-render-worker` on `execution.render.requested {tenantId, runId}`:
   re-check approval/kill/credentials/budget → adapter submit (idempotent, provider job id lưu run row
   — migration `0486`: `provider_job_id`, `render_attempts`) → `step.sleep` poll → bytes →
   R2 `VIDEO_BUCKET` key tenant-scoped → sha256/size/magic-verify → `recordVerifiedArtifact`.
2. SSRF: chỉ fetch API provider có key + host allowlist `*.heygen.com`/CDN trả về từ job của mình;
   chặn redirect, cap size, timeout; callback URL tùy ý KHÔNG fetch.
3. Dispatcher: sau render_queued → send `execution.render.requested`. Cost: reserved từ approval,
   actual từ provider invoice (NULL → UI "chưa đối soát"). Không publish thật.
4. Test: adapter fixture có nhãn + storage memory; prod path ép `is_fixture=0`.

## PR3 — Legacy postback migration (tương thích)

1. Legacy A (`saas-crypto/[network]`): giữ HMAC global → resolve tenant CHỈ qua `tracking_links`
   (dùng lại Domain B extract+lookup); bỏ trust `body.affiliate_id/sub_id`; mapping fail →
   dead-letter bền vững + `200 {status:'unmapped'}`; transient→503; invalid→401/400;
   secret-missing→500 (sửa #72 503 + test).
2. Legacy B (`affiliate/[network]`): giữ hành vi Refer Sophia; bổ sung docs + nhãn.
3. Docs VI/EN: guide pillars đánh dấu legacy + hướng migration; runtime docs cập nhật.
   Không xóa endpoint, không sunset.

## Acceptance criteria (map 10 mục founder directive)

1. Approve/reject đúng: CAS 1 winner; double-approve không double-send (test concurrency).
2. Binding đầy đủ: tenant/campaign/offer/artifact/destination/jurisdiction/budget/hash — guard fail
   khi bất kỳ field nào lệch (test từng field).
3. Expiry/revoke/executed: row hết hạn/revoked/executed bị guard chặn; resume chỉ chạy cho
   approved-stuck (test).
4. Pre-side-effect re-verification: worker render re-check approval+killer+credential+budget trước
   submit (test kill-after-approve → blocked).
5. Render thật: bytes→R2→sha256 khớp; fixture không qua prod path (test tách contract).
6. SSRF/TOCTOU: callback URL lạ/redirect/cross-tenant key bị chặn (test).
7. Chi phí: reserved từ approval, actual hoặc "chưa đối soát" (test).
8. Legacy: global-HMAC + mapping server-side; body tenant bị bỏ qua (test spoof);
   unmapped→dead-letter+200; invalid→401/400; transient→503; secret-missing→500 (test).
9. i18n VI/EN cho mọi status/surface mới; no-console prod; `:any` = 0.
10. CI xanh 3 PR (type-check/lint/boundaries/i18n/tests/build/migration) + deploy + live SHA-prefix.

## Lệnh kiểm chứng (ghi exit code vào verification log)

`pnpm type-check`, `pnpm lint`, `pnpm test -- <scope>`, `pnpm build` (hoặc scope CI tương đương),
migration apply local D1, `gh pr checks`, deploy run + `/api/version` SHA-prefix.
