# Sophia AI Factory — Evidence Vault 02: Paid Pilot Roadmap, Agency Reseller Persona, Quarterly OKRs & Founder Operating Review
# Kho Bằng Chứng 02: Lộ Trình Pilot Trả Phí, Chân Dung Agency Reseller, OKR Quý & Quy Chế Rà Soát Của Founder

**Prepared / Ngày lập:** 2026-11-09  
**Blueprint Steps Covered / Các bước Blueprint:** Step 5 (Gap Report & First Paid Pilot Roadmap), Step 7 (Agency & Developer Personas), Step 11 (Track B Sparse-Data MAB Guard), Step 22 (Quarterly OKRs), Step 23 (Founder Operating Review Cadence)  
**Truthful Stage Baseline / Nền tảng sự thật:** `Zero → Problem-Solution Fit (PSF)` · `mrr_usd: 0` · `paying_customers: 0` (`.mekong/company.json`)

---

## 1. Step 5 — Gap Report & 6-Checkpoint First Paid Pilot Playbook

### 🇻🇳 Báo cáo khoảng cách & Lộ trình chốt khách hàng Pilot trả phí đầu tiên
- **Trạng thái kỹ thuật (Engineering Readiness):** 100% hoàn tất. Luồng thanh toán NOWPayments (USDT) và PayOS (VietQR NAPAS 247), cổng kiểm soát bản quyền `enforceCommercialFeatureForUser`, cùng trình theo dõi `src/tree/open-core/pilot-onboarding-tracker.ts` đã hoạt động trên môi trường Production (`https://sophia.agencyos.network`).
- **Khoảng cách thương mại hiện tại (Commercial Gap):** `0 paying customers` (`$0 MRR`). Việc chuyển từ `0 → 1` khách hàng trả phí thuộc thẩm quyền trực tiếp của Founder dựa trên 6 bước kiểm chứng trong `pilot-onboarding-tracker.ts`:
  1. `byok_configured`: Khách hàng tự nhập khóa OpenRouter, ElevenLabs, HeyGen/D-ID qua Setup Wizard.
  2. `telegram_webhook_verified`: Kết nối `@Sophia_Bbot` thành công cho thông báo chiến dịch.
  3. `first_video_rendered`: Xuất bản thành công video đầu tiên từ pipeline Inngest.
  4. `payment_webhook_settled`: Đối soát lệnh thanh toán thực tế qua NOWPayments IPN hoặc PayOS VietQR (`BASIC $199` hoặc `PREMIUM $399`).
  5. `partner_network_initialized`: Kích hoạt mạng lưới cộng tác viên trên `/[locale]/dashboard/affiliate`.
  6. `day30_retention_review`: Đánh giá tỷ lệ duy trì sau 30 ngày và thu thập phản hồi có sự đồng thuận bằng văn bản.

### 🌐 Engineering vs. Commercial Gap Summary
- **Engineering Readiness:** Complete and verified in production (`pilot-onboarding-tracker.ts`, `enforceCommercialFeatureForUser`, NOWPayments/PayOS webhooks).
- **Commercial Reality:** `0 paying customers` (`$0 MRR`). Closing the first paid agency pilot is tracked transparently as a founder-executed commercial milestone without fabricating synthetic customer records.

---

## 2. Step 7 — Agency Reseller ICP & Open-Source Developer Personas

### 🇻🇳 Chân dung Khách hàng Mục tiêu (ICP) & Lập trình viên Open-Core
Được lượng hóa và chấm điểm tự động qua mô-đun `src/tree/open-core/discovery-interview-evaluator.ts`:

| Persona / Nhóm đối tượng | Vai trò & Nhu cầu cốt lõi (Job-to-be-Done) | Gói mục tiêu & Cơ chế chuyển đổi |
|---|---|---|
| **1. Vietnamese Marketing & Affiliate Agency Owner (Primary Commercial ICP)** | Cần sản xuất video ngắn số lượng lớn cho khách hàng và tuyển đội ngũ cộng tác viên (CTV/Affiliate) bán chéo dịch vụ với thanh toán nội địa VietQR NAPAS 247 hoặc USDT. | **PREMIUM ($399/mo) / ENTERPRISE ($799/mo):** Mở khóa **Partner-Resell Kit** (`WorkspacePartnerNetworkCard`), phê duyệt CTV `under_review → active`, và xuất lô chi trả Dual-Rail. |
| **2. Open-Source Developer / Technical Evaluator (Secondary PLG Wedge)** | Muốn tự chạy thử (Self-Host) trên máy cá nhân, kiểm tra mã nguồn `Apache-2.0` và cơ chế bảo mật khóa BYOK trước khi đề xuất CEO mua gói Cloud. | **COMMUNITY (`Apache-2.0`) → CLOUD:** Dùng gói miễn phí trên GitHub, sau đó xuất gói di chuyển có chữ ký HMAC (`/api/open-core/portability`) lên Sophia Cloud trong `< 60 giây`. |

---

## 3. Step 11 — Track B Sparse-Data Growth Guard for Quantitative Creative & Paywall Testing

### 🇻🇳 Cơ chế Bảo vệ Dữ liệu Thưa (Track B Sparse-Data Guard)
Theo báo cáo nghiên cứu *Sophia AI Factory Research*, thuật toán Thompson Sampling MAB và phân bổ vốn Half-Kelly sẽ bị nhiễu loạn nếu chạy khi chưa có đủ lưu lượng khách hàng thực tế. Sophia đã khóa cứng cổng bảo vệ tại `src/tree/growth/sparse-data-growth-guard.ts`, `src/tree/monetization/paywall-mab-engine.ts`, và `src/forest/inngest/functions/paywall-mab-recalibration-job.ts`:
- **Khi `< 100` chuyển đổi xác thực/tháng HOẶC `< 1.000` lượt hiển thị mỗi biến thể HOẶC tuổi tài khoản `< 30 ngày`:** Hệ thống tự động khóa ở chế độ `deterministic_rule_based` (chọn gói cơ sở rẻ nhất khi `conversions === 0` hoặc gói có doanh thu kỳ vọng thực nghiệm cao nhất mà không gọi hàm ngẫu nhiên `sampleBetaValue`), đồng thời tạm hoãn lệnh ghi DB trong Inngest job `paywallMabRecalibrationJob`.
- **Khi đạt đủ ngưỡng `>= 100` chuyển đổi/tháng VÀ `>= 1.000` lượt hiển thị/biến thể:** Tự động mở khóa chế độ `thompson_half_kelly`.

---

## 4. Step 22 & Step 23 — Quarterly OKR Scorecard & Monthly Founder Operating Review

### 🇻🇳 Bảng điểm OKR Quý (Q4 2026 – Q1 2027) & Lịch Rà Soát Vận Hành Hàng Tháng

| OKR ID | Objective / Key Result (Song ngữ VN/EN) | Current Verified Baseline (`2026-11-09`) | 6-Month Target (`2027-04-17`) | Verification Source |
|---|---|---|---|---|
| **KR-1** | Khách hàng Agency trả phí qua NOWPayments/PayOS (Paid Agency Pilots) | **0 paying customers ($0 MRR)** | **3 paid pilots** ($597–$1,197 MRR) | `.mekong/company.json` & D1 `subscriptions` ledger |
| **KR-2** | Cộng đồng mã nguồn mở GitHub Stars trên Community Core (`Apache-2.0`) | **Baseline tracked on GitHub** | **500+ GitHub Stars** | GitHub Repository Telemetry |
| **KR-3** | Chuyển đổi từ Self-Hosted sang Sophia Cloud qua `/api/open-core/portability` | **0 migrations (infrastructure live)** | **5 verified migrations** | D1 portability import audit log |
| **KR-4** | Độ hoàn thiện kiến trúc 25 bước & cổng bảo vệ kỹ thuật (Engineering Readiness) | **25/25 steps verified (100%)** | **Maintain 100% parity** | `node scripts/verify-open-core-readiness.mjs` |

### 🌐 Monthly Founder Operating Review Protocol (Step 23)
Held on the **1st Monday of every month**, governed by `plans/company-blueprint/plan.md` and `plans/company-blueprint/tasks.md`:
1. **Cash & Billing Audit:** Reconcile NOWPayments (USDT) and PayOS (VND) settled webhooks against D1 subscription activations and `.mekong/company.json`.
2. **Partner-Resell Kit Audit:** Review tenant-isolated partner signups (`affiliate_partners.tenant_id`), `under_review` approval latency, and Dual-Rail payout batch exports.
3. **Sparse-Data MAB Gate Check:** Inspect `evaluatePaywallArmsSparseDataGate` telemetry to confirm whether any campaign has crossed the `100 conversions/mo` + `1,000 impressions/variant` threshold.
4. **CI/CD & Open-Core Hygiene:** Run `node scripts/verify-open-core-readiness.mjs` and verify bit-for-bit `shortSha` parity on `https://sophia.agencyos.network/api/version`.
