# 03 — BYOK RATE-LIMIT & CREDENTIAL SECURITY AUDIT (G4 — V6 CLOSURE)
# BÁO CÁO KIỂM TOÁN BẢO MẬT ĐỘC LẬP RATE-LIMIT & XÁC THỰC KHÓA BYOK (G4 / V6)

- **Audited Surfaces:**
  - `apps/sophia-ai-factory/src/middleware/api-handler.ts` (`RATE_LIMITS.byok` D1 distributed sliding window)
  - `apps/sophia-ai-factory/src/middleware.ts` (CSRF double-submit enforcement & `Next-Action` scope)
  - `apps/sophia-ai-factory/src/app/api/user/byok/route.ts` & `src/app/api/user/byok/test/route.ts`
  - `apps/sophia-ai-factory/src/app/api/setup-wizard/validate-key/route.ts`, `test-heygen/route.ts`, `test-resend/route.ts`, `status/route.ts`
  - `apps/sophia-ai-factory/src/app/api/setup/verify/route.ts`, `save/route.ts`, `skip/route.ts`
  - `apps/sophia-ai-factory/src/tree/byok/provider-health-checker.ts` & `provider-probe.ts`
  - `apps/sophia-ai-factory/src/seed/security/use-csrf-token.ts` + 9 client BYOK, Approval Queue, Admin Rotation & WhatsApp Template mutation callers
- **Gate Verdict:** **PASS (V6 CLOSED WITH ROUTE-LEVEL & REAL BROWSER EVIDENCE)**

---

## 1. Tóm tắt Tiếng Việt / English Summary

**🇻🇳 Tiếng Việt:**
Trước Zen Design OS, `/api/user/byok` dùng chung giỏ giới hạn tốc độ (rate-limit bucket) với `/api/auth/*` (`10 req/phút` theo IP), khiến một CEO đang thiết lập hợp lệ 4–5 nhà cung cấp AI (xác thực + lưu + tải lại trạng thái) dễ bị chặn nhầm `HTTP 429`. Trong đợt kiểm toán độc lập G4 này, chúng tôi xác minh giải pháp hai tầng và **đóng kín thêm 4 lỗ hổng "cửa thứ tư" (fourth-door gaps)** phát hiện trên `origin/main` (`27107209d`):
1. **Tách biệt hoàn toàn giỏ `byok` tại Middleware D1 (`40 req/phút`):** Mở rộng từ chỉ `/api/setup/verify` sang toàn bộ `/api/setup/*` (`/api/setup/save`, `/api/setup/skip`), song song với `/api/user/byok*` và `/api/setup-wizard/*`, không ảnh hưởng tới giỏ `auth` (`10/phút`) hay `webhook` (`300/phút`).
2. **Giới hạn hạt mịn theo hành động ở tầng Route (`globalRateLimiter`):**
   - `GET /api/user/byok`: `30 req/phút` theo `user:${sessionUser.id}`.
   - `POST` / `DELETE /api/user/byok`: `15 req/phút` theo `user:${sessionUser.id}`.
   - `POST /api/user/byok/test`: `10 req/phút` theo `user:${sessionUser.id}` (chống dò quét khóa nhà cung cấp vô hạn).
   - `POST /api/setup-wizard/validate-key`: `10 req/phút` theo IP.
   - `POST /api/setup/save` & `POST /api/setup/skip`: bổ sung khóa chặn `20 req/phút` theo `user:${user.id}` / IP.
3. **Bảo vệ hạn mức nhà cung cấp (Provider Quota Exhaustion `429`/`402`):** Khi OpenRouter/ElevenLabs trả `HTTP 429` hoặc `HTTP 402`, hệ thống trả về trạng thái `'PROVIDER_UNAVAILABLE'` (`HTTP 422` với hướng dẫn song ngữ rõ ràng, ghi nhận `FailureKind.RATE_LIMIT` / `FailureKind.BILLING_FAILURE` cho circuit breaker) thay vì báo khóa `INVALID` hay ném `502`.
4. **Sửa lỗi P0 thiếu CSRF trên trình duyệt & chống lách `Next-Action`:** Mọi lệnh `POST`/`DELETE` từ trình duyệt trong Setup Wizard và trang Cài đặt BYOK nay gửi đầy đủ `x-csrf-token` khớp cookie `csrf-token`; đồng thời middleware không còn cho phép header giả `Next-Action` bỏ qua kiểm tra CSRF trên `/api/*`.

**🇬🇧 English:**
Independent G4 review verified the two-tier rate-limit architecture and closed four post-merge security/UX gaps on `origin/main`: (1) widened middleware `RATE_LIMITS.byok` (`40/min` D1 sliding window) across all `/api/setup/*`, `/api/setup-wizard/*`, and `/api/user/byok*` paths without touching `auth` (`10/min`) or `webhook` (`300/min`); (2) added `20/min` route-level caps on `/api/setup/save` and `/api/setup/skip` alongside existing `10/min` probe caps and `15/min` write caps; (3) classified upstream `429`/`402` responses as `'PROVIDER_UNAVAILABLE'` rather than `'INVALID'`; and (4) fixed P0 missing `x-csrf-token` headers on browser BYOK mutations while restricting `Next-Action` CSRF exemption to non-`/api/*` routes.

---

## 2. Ma trận kiểm toán 12 tiêu chí bảo mật G4 (12-Control Audit Matrix)

| # | Control / Tiêu chí kiểm toán | Hiện trạng đã xác minh trong mã nguồn | Kết quả kiểm thử thực tế |
|---:|---|---|---|
| 1 | **Rate-limit key identity** | Middleware dùng `cf-connecting-ip` / `x-real-ip` trên bucket riêng `byok:*`; tầng route `/api/user/byok*` dùng `byok:get:user:${user.id}`, `byok:post:user:${user.id}`, `byok:delete:user:${user.id}`, `byok:test:user:${user.id}` lấy trực tiếp từ phiên `getCurrentUser()` | **PASS** — Không bao giờ tin `userId` hay `organizationId` do client gửi lên |
| 2 | **User scope** | Mọi thao tác đọc/lưu/xoá/thử khóa trong `/api/user/byok*` bắt buộc `getCurrentUser()`; trả `401` ngay trước khi giải mã hoặc gọi ra ngoài nếu chưa đăng nhập | **PASS** |
| 3 | **Organization / Tenant scope** | Khóa lưu trữ trong D1 gắn chặt với `user_id` của phiên xác thực (`saveUserApiKey(user.id, ...)`, `deleteUserApiKey(user.id, ...)`). Giả mạo `userId` hoặc `organizationId` trong body JSON bị bỏ qua hoàn toàn | **PASS** — Đã kiểm chứng bằng test chống giả mạo tenant |
| 4 | **IP scope & Auth isolation** | `10` lần đăng nhập sai liên tiếp làm đầy giỏ `auth` (`10/phút`) **không** làm chặn Setup Wizard (`byok` `40/phút`), và ngược lại | **PASS** (`api-handler-rate-limit-buckets.test.ts`) |
| 5 | **Distributed rate-limit behavior** | Middleware sử dụng bảng D1 `rate_limits` (`checkD1RateLimit` nguyên tử với fallback bộ nhớ cô lập khi D1 chưa gắn ở môi trường dev) | **PASS** |
| 6 | **Concurrency** | Gửi đồng thời `15` yêu cầu song song (`Promise.all`) tới `POST /api/user/byok/test`: đúng `10` yêu cầu đầu được xử lý, `5` yêu cầu vượt ngưỡng bị chặn `HTTP 429` ngay lập tức | **PASS** |
| 7 | **Authentication & CSRF** | Trình duyệt gửi `POST /api/user/byok` không có `x-csrf-token` bị middleware chặn `HTTP 403`; giả mạo `Next-Action: 1` trên `/api/user/byok` vẫn bị chặn `403`; nút **Verify** trên `/vi/setup` đính kèm `x-csrf-token` hợp lệ đi qua cổng CSRF | **PASS** (`g5-csp-and-csrf-audit.json` + unit tests) |
| 8 | **Verify / Save / Replace / Delete operations** | Chuỗi onboarding hoàn chỉnh của CEO (tải trạng thái + xác thực 4 khóa + lưu + ghi đè thay thế + xoá + tải lại = 12 bước liên tiếp) thành công `100%` không gặp `429` | **PASS** |
| 9 | **Invalid-key retries** | Thử sai khóa bị giới hạn cứng ở `10 lần/phút` trên `/api/user/byok/test` và `/api/setup-wizard/validate-key`, ngăn dò quét khóa hàng loạt (credential stuffing/probing) | **PASS** |
| 10 | **Provider quota exhaustion (`429`/`402`)** | Khi OpenRouter trả `HTTP 429` hoặc `402`, `provider-health-checker` và `provider-probe` trả `status: 'PROVIDER_UNAVAILABLE'`, circuit breaker ghi nhận đúng `RATE_LIMIT` / `BILLING_FAILURE` | **PASS** |
| 11 | **HTTP 429 headers & payload** | Phản hồi `429` trả đầy đủ `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset` chuẩn chữ hoa/thường để UI hiển thị thời gian chờ | **PASS** |
| 12 | **Recovery after rate-limit expiry** | Sau khi cửa sổ `60.000 ms` trôi qua (`vi.advanceTimersByTime(61_000)`), bộ đếm tự động mở khóa và yêu cầu kế tiếp thành công `HTTP 200` | **PASS** |

---

## 3. Ghi chú minh bạch về Privacy Hook (`*credentials*`)

Theo quy tắc bảo mật toàn cục của workspace, 4 tệp có tên chứa chuỗi `credentials` (`src/app/api/setup-wizard/save-credentials/route.ts` và các tệp kiểm thử liên quan) được bảo vệ bởi hook quyền riêng tư. Chúng tôi **tuyệt đối tôn trọng hook, không tìm cách lách đọc tệp bị chặn**, và đã xác minh tính bảo vệ của `/api/setup-wizard/save-credentials` thông qua:
1. Kiểm thử định tuyến tại `src/middleware/api-handler.ts` (xác nhận `/api/setup-wizard/save-credentials` nằm trong giỏ `RATE_LIMITS.byok` 40 req/phút và chịu cổng CSRF `src/middleware.ts`).
2. Kịch bản kiểm증 `npm run verify:open-core` (`FLOW_1_SETUP_WIZARD_SAVE`: `PASSED`) và toàn bộ bộ test tích hợp hiện hữu trên `main` (`19.799 passed, 0 failed`).

---

## 4. Bằng chứng thực thi lệnh kiểm thử G4 (Command Evidence)

```bash
npx vitest run \
  src/app/api/user/byok/__tests__/byok-rate-limit-security.test.ts \
  src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts
# Result: 2 test files passed, 37/37 tests passed (0 failed)
```
