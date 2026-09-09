# Runbook: Production Canary Verification & Distributed Correlation Tracing

**Document ID:** RUN-CANARY-001  
**Severity:** P0 — Production Readiness & Canary Gate  
**Classification:** PRODUCTION VERIFICATION (Fail-Closed, Non-Fabricated)  
**Effective Date:** 2026-09-10  
**Target Systems:** Creative Studio, fal.ai Image Generation, R2 Storage, D1 `media_jobs`, Credit Accounting  

---

## 1. Mục đích & Phạm vi / Purpose & Scope

### 🇻🇳 Vietnamese
Tài liệu này hướng dẫn quy trình xác minh Canary trên môi trường Production cho Sophia AI Factory.
Mục tiêu cốt lõi:
1. Xác minh toàn bộ chuỗi thực thi: từ yêu cầu người dùng → giải quyết khóa BYOK → gọi API nhà cung cấp AI → lưu trữ R2 vĩnh viễn → ghi nhận D1 `media_jobs` → khấu trừ MCU credits → phát hành sự kiện đo lường (metering usage event).
2. Kiểm tra tính liên tục của **8 Correlation IDs** qua các ranh giới bất đồng bộ.
3. **Tuyệt đối tuân thủ quy tắc Fail-Closed:** Khi thiếu danh tính founder thật hoặc thiếu khóa API, quy trình PHẢI DỪNG LẠI và báo cáo BLOCKED, không tự ý giả mạo dữ liệu hay tạo credential giả.

### 🇬🇧 English
This SOP governs the Production Canary Verification procedure for Sophia AI Factory.
Core objectives:
1. Verify the end-to-end execution chain: User Request → BYOK Key Resolution → AI Provider API Call → Permanent R2 Persistence → D1 `media_jobs` Record → MCU Credit Deduction → Telemetry Usage Event Emission.
2. Validate traceability across all **8 Correlation IDs** traversing asynchronous boundaries.
3. **Strict Fail-Closed Enforcement:** If legitimate founder identities or provider keys are absent, the process MUST STOP at the gate and report BLOCKED. No fake identities, mock credentials, or synthetic results may be fabricated.

---

## 2. Chuỗi tương quan 8 định danh / The 8 Canonical Correlation IDs

Hệ thống duy trì khả năng truy vết hoàn chỉnh (full end-to-end distributed tracing) qua 8 định danh:

```
[1. user_id] + [2. organization_id]
         ↓
   [3. request_id] (API Entry / Server Action)
         ↓
   [4. mission_id] (Agent Orchestration / Creative Studio Plan)
         ↓
   [5. job_id] (Local D1 `media_jobs` primary key: `fal-<timestamp>-<hash>`)
         ↓
   [6. provider_job_id] (Upstream provider reference / request ID)
         ↓
   [7. artifact_id] (R2 permanent storage key: `generated-images/fal-...png`)
         ↓
   [8. usage_event] (Metered billing event & idempotency key in `usage_events`)
```

### Bảng đối chiếu trường dữ liệu / Field Mapping Matrix

| Correlation ID | Originating Layer | D1 Table / Storage Location | Code Source Reference |
|---|---|---|---|
| **1. user_id** | `seed/auth` | `user.id`, `user_profiles.user_id`, `media_jobs.user_id` | `getCurrentUser()`, Better Auth session |
| **2. organization_id** | `seed/auth` | `organization.id`, `member.organizationId` | Better Auth organization plugin |
| **3. request_id** | `middleware` / API | HTTP Header `x-request-id`, Log context | `src/middleware.ts`, `image-generate-action.ts:117` |
| **4. mission_id** | `forest/inngest` | `missions.id`, `agent_runs.mission_id` | `src/land/creative-mission/actions.ts:682` |
| **5. job_id** | Action / Route | `media_jobs.id` (`fal-${Date.now()}-${rand}`) | `src/app/actions/image-generate-action.ts:117` |
| **6. provider_job_id** | `seed/ai` (fal.ai) | Provider payload response / request log | `FalImageProvider.generate()`, fal response |
| **7. artifact_id** | `forest/storage` | `media_jobs.storage_key` (`generated-images/...`) | `storeFalImageInR2()`, Cloudflare R2 |
| **8. usage_event** | `tree/usage-metering`| `usage_events.idempotency_key` (`${userId}-${jobId}`) | `trackUsage()`, `deductCredits()` |

---

## 3. Điều kiện tiên quyết của Canary / Canary Prerequisites

Canary CHỈ được phép thực thi khi hội đủ 3 điều kiện sau:

| Điều kiện / Prerequisite | Trạng thái hiện tại / Current Status | Cách xác minh / Verification |
|---|---|---|
| **1. Tài khoản Operator thật** | ⚠️ OPERATOR REQUIRED (P0-01) | Phải có tài khoản admin thật theo `docs/runbooks/OPERATOR-BOOTSTRAP.md`. CẤM dùng user test/seed. |
| **2. Khóa FAL_KEY hợp lệ** | ⚠️ BYOK REQUIRED (P0-02) | Người dùng cấu hình khóa fal.ai thật qua Setup Wizard (`/vi/setup` hoặc `/api/user/byok`). |
| **3. Số dư MCU Credits đủ** | Cần ≥ 1 MCU | Kiểm tra số dư MCU credits của tài khoản trước khi gọi API. |

**NẾU BẤT KỲ ĐIỀU KIỆN NÀO TRÊN CHƯA ĐẠT:**  
DỪNG LẠI NGAY LẬP TỨC. Báo cáo trạng thái **BLOCKED** hoặc **CONDITIONAL**. Không bao giờ bypass hoặc giả lập kết quả.

---

## 4. Quy trình thực hiện Canary từng bước / Step-by-Step Canary Procedure

### Bước 4.1: Xác thực danh tính người dùng thực
1. Đăng nhập vào giao diện web production tại `https://sophia.agencyos.network/vi/login`.
2. Kiểm tra `user_profiles.role` trong D1:
   ```bash
   npx wrangler d1 execute sophia-raas-db \
     --command "SELECT user_id, role FROM user_profiles WHERE user_id = '<LOGGED_IN_USER_ID>';" \
     --remote
   ```
   *Yêu cầu: `role = 'admin'`.*

### Bước 4.2: Lưu trữ khóa BYOK fal.ai
1. Truy cập Setup Wizard (`/vi/setup`) hoặc gửi request tới `/api/user/byok`:
   ```bash
   curl -X POST "https://sophia.agencyos.network/api/user/byok" \
     -H "Content-Type: application/json" \
     -H "Cookie: <OPERATOR_SESSION_COOKIE>" \
     -d '{"provider": "fal-ai", "apiKey": "key-test-real-key-here"}'
   ```
2. Xác nhận khóa được mã hóa AES-GCM-256 trong `user_api_keys`:
   ```bash
   npx wrangler d1 execute sophia-raas-db \
     --command "SELECT provider, key_version, created_at FROM user_api_keys WHERE user_id = '<LOGGED_IN_USER_ID>' AND provider = 'fal-ai';" \
     --remote
   ```
   *Yêu cầu: Row tồn tại, dữ liệu `encrypted_key` không thể đọc dưới dạng plain text.*

### Bước 4.3: Kích hoạt Canary Image Generation
1. Thực hiện tạo ảnh thử nghiệm từ giao diện Creative Studio hoặc gọi Server Action / API route:
   ```bash
   curl -X POST "https://sophia.agencyos.network/api/v1/creative-studio/images/generate" \
     -H "Content-Type: application/json" \
     -H "Cookie: <OPERATOR_SESSION_COOKIE>" \
     -d '{
       "prompt": "Minimalist geometric architectural rendering, golden hour, 8k canary probe",
       "aspectRatio": "16:9",
       "model": "fal-ai/flux/schnell"
     }'
   ```
2. Lưu lại `jobId` từ phản hồi HTTP 201:
   `{"jobId": "fal-1789000000000-abcdef12"}`

### Bước 4.4: Xác minh 8 Correlation IDs trong Production D1 & R2

Thực thi truy vấn tổng hợp để chứng minh tính khép kín của chuỗi tương quan:

```bash
JOB_ID="fal-1789000000000-abcdef12"

# 1. Kiểm tra media_jobs record:
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT id, user_id, type, model, status, result_url, storage_key, bucket, provider, provider_cost, latency_ms FROM media_jobs WHERE id = '${JOB_ID}';" \
  --remote

# 2. Kiểm tra R2 permanent asset tồn tại:
npx wrangler r2 object get sophia-media/generated-images/${JOB_ID}.png --remote

# 3. Kiểm tra usage_events record (metering):
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT id, user_id, service, action, credits_used, request_id, status_code, response_time_ms FROM usage_events WHERE request_id = '${JOB_ID}';" \
  --remote

# 4. Kiểm tra trừ MCU credits trong ledger:
npx wrangler d1 execute sophia-raas-db \
  --command "SELECT id, user_id, amount, balance_after, description FROM credit_transactions WHERE description LIKE '%${JOB_ID}%';" \
  --remote
```

### Bước 4.5: Tiêu chí Đạt / Pass Criteria
- [ ] HTTP 201 Created trả về `jobId` hợp lệ.
- [ ] `media_jobs` cập nhật trạng thái `completed`.
- [ ] `storage_key` trong `media_jobs` trỏ đến object hợp lệ trong R2 (không dùng URL CDN tạm thời).
- [ ] `provider_cost` và `latency_ms` được ghi nhận chính xác.
- [ ] `usage_events` ghi nhận đúng `credits_used` và mã phản hồi 200.
- [ ] Số dư credits giảm chính xác tương ứng với biểu phí MCU.
- [ ] Không rò rỉ bất kỳ thông tin nhạy cảm nào trong log hoặc API response.

---

## 5. Xử lý sự cố Canary / Canary Failure Triage

| Hiện tượng | Nguyên nhân gốc rễ | Hướng xử lý |
|---|---|---|
| `NO_API_KEY` (502) | Người dùng chưa nhập khóa fal.ai qua Setup Wizard | Khách hàng/Operator cần bổ sung key vào `/vi/setup` |
| `INSUFFICIENT_CREDITS` (402) | Số dư MCU credits bằng 0 | Nạp credits qua gói thanh toán hoặc credit ledger |
| `STORAGE_ERROR` (500) | Kết nối Cloudflare R2 bị lỗi hoặc binding thiếu | Kiểm tra binding `sophia-media` trong `wrangler.toml` |
| `CIRCUIT_BREAKER_OPEN` (502) | Provider fal.ai đang lỗi diện rộng hoặc key bị từ chối 401 | Kiểm tra tính hợp lệ của FAL_KEY và status của fal.ai |

---

*Last updated: 2026-09-10. Cross-reference: `src/app/actions/image-generate-action.ts`, `docs/audit/HANDOVER-HARDENING-BACKLOG.md`.*
