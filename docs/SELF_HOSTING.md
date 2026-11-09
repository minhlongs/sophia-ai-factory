# Self-Hosting Sophia AI Factory vs. Sophia Managed Cloud

> **Bilingual Guide (English & Tiếng Việt)** — How to run the `Apache-2.0` Community Core locally and when to upgrade to **Sophia Managed Cloud** (`https://sophia.agencyos.network`) or **Master Handover (`$4,999`)**.
>
> **Hướng Dẫn Song Ngữ (Tiếng Việt & English)** — Cách tự vận hành phiên bản Cộng đồng (`Apache-2.0`) và khi nào nên nâng cấp lên **Sophia Managed Cloud** (`https://sophia.agencyos.network`) hoặc **Bàn Giao Master (`$4,999`)**.

---

## 1. Edition Overview / Tổng Quan Các Phiên Bản (`SOPHIA_EDITION`)

Sophia AI Factory supports three runtime editions configured via `SOPHIA_EDITION` (resolved in `src/seed/config/edition-config.ts`) and enforced server-side via `enforceCommercialFeatureForUser` (`src/seed/config/enforce-commercial-feature-server.ts`):

1. **`SOPHIA_EDITION=community` (Default for Self-Hosters — Free / Apache-2.0)**
   - **EN:** Includes the 4-layer foundation (`seed/`), BYOK AES-256-GCM Setup Wizard, Bilingual `/ask` Router & 4-Advisor Consultation (`tree/ask/`), Telegram Bot commands (`@Sophia_Bbot`), single-workspace AI video script/TTS generation, and `tenant_id`-scoped affiliate attribution primitives.
   - **VI:** Bao gồm nền tảng 4 tầng (`seed/`), Trình Cài Đặt BYOK mã hóa AES-256-GCM, Trợ lý `/ask` 4 Cố vấn song ngữ (`tree/ask/`), Bot Telegram (`@Sophia_Bbot`), tạo kịch bản/giọng đọc AI cho 1 workspace, và bộ ghi nhận click/chuyển đổi affiliate phân tách theo `tenant_id`.

2. **`SOPHIA_EDITION=cloud` (Official Managed SaaS — `$199 / $399 / $799 per month`)**
   - **EN:** Hosted at `https://sophia.agencyos.network`. Unlocks Direct Social Publisher (`/dashboard/publish`), 24/7 Inngest durable queues, Growth Triad v14 (Thompson Sampling MAB + Half-Kelly allocator), and the **Partner-Resell Kit** on `/[locale]/dashboard/affiliate` (multi-partner recruitment, `under_review` risk-flag holdback & approval, and Dual-Rail VietQR NAPAS 247 + USDT TRC-20 payouts).
   - **VI:** Vận hành tại `https://sophia.agencyos.network`. Mở khóa Đăng Bài Đa Kênh Trực Tiếp (`/dashboard/publish`), hàng đợi Inngest 24/7, Growth Triad v14, và **Bộ Công Cụ Quản Lý Mạng Lưới CTV (Partner-Resell Kit)** tại `/[locale]/dashboard/affiliate` (tuyển CTV theo `tenant_id`, giữ tiền tự động các CTV bị gắn cờ `under_review` chờ chủ Workspace duyệt, và xuất lô chi trả Dual-Rail VietQR NAPAS 247 + USDT TRC-20).

3. **`SOPHIA_EDITION=enterprise` (Self-Hosted Commercial / Master Handover — `$4,999`)**
   - **EN:** Unlocked on self-hosted infrastructure by setting a cryptographically signed `RAAS_LICENSE_KEY` (`SOPHIA-RAAS-v1.<payload>.<hmac-sha256>`) verified by `src/seed/security/raas-license-verifier.ts`. Enables White-Label Agency Subaccount Portal, Custom Domains, Cryptographic Merkle IPO Audit Vault, and Day-1 Master Handover probes.
   - **VI:** Mở khóa trên hạ tầng tự host bằng khóa bản quyền ký số `RAAS_LICENSE_KEY` (`SOPHIA-RAAS-v1.<payload>.<hmac-sha256>`) được xác thực bởi `src/seed/security/raas-license-verifier.ts`. Kích hoạt Cổng Đại Lý White-Label, Tên Miền Riêng (Custom Domains), Sổ Cái Kiểm Toán Merkle và Bộ Kiểm Tra Bàn Giao Master.

---

## 2. Server-Side Feature Gates & Multi-Tenant Isolation / Cổng Kiểm Soát Phiên Bản & Cách Ly Đa Thuê Bao (`tenant_id`)

- **Server-Side Edition Enforcement (`enforceCommercialFeatureForUser`):**
  - **EN:** Every commercial capability declared in `src/seed/config/open-core-manifest.ts` (`direct_social_publisher`, `custom_domain_provisioning`, `white_label_agency_portal`, `affiliate_attribution_payouts`) is enforced on the server before any mutation or batch export executes.
  - **VI:** Mọi tính năng thương mại khai báo trong `src/seed/config/open-core-manifest.ts` đều được kiểm tra quyền truy cập trực tiếp ở phía server trước khi thực thi.
- **Strict `tenant_id` Isolation (`0500` & `0501` Migrations):**
  - **EN:** Affiliate links, clicks, conversions, partners (`affiliate_partners`), referrals (`affiliate_referrals`), commissions (`affiliate_commissions`), and payouts (`affiliate_payouts`) are isolated by `tenant_id = user.id`. Partners flagged `under_review` are automatically held back from Dual-Rail payout batches (`status = 'active'` required) until explicitly approved by the workspace owner.
  - **VI:** Toàn bộ dữ liệu link tiếp thị, lượt click, chuyển đổi, danh sách CTV (`affiliate_partners`), giới thiệu (`affiliate_referrals`), hoa hồng (`affiliate_commissions`) và chi trả (`affiliate_payouts`) đều được cách ly theo `tenant_id = user.id`. Các CTV bị gắn cờ `under_review` tự động được giữ lại ngoài lô thanh toán cho đến khi chủ Workspace bấm duyệt.

---

## 3. Running the Community Edition Locally / Chạy Phiên Bản Cộng Đồng Tại Máy Cá Nhân

```bash
cp .env.community.example apps/sophia-ai-factory/.env.local
cd apps/sophia-ai-factory
npm install
npm run type-check
npm test
npm run dev
```

---

## 4. Why Non-Technical CEOs & Agencies Choose Sophia Managed Cloud / Vì Sao CEO Không Chuyên Kỹ Thuật & Agency Chọn Sophia Cloud

- **EN:** Zero-ops Cloudflare Workers edge runtime, pre-configured social publishing relays, and built-in Dual-Rail (VietQR NAPAS 247 CSV + USDT TRC-20 NOWPayments) partner payouts without maintaining custom infrastructure.
- **VI:** Không cần vận hành máy chủ, tích hợp sẵn cổng đăng video đa kênh và hệ thống quản lý/chi trả hoa hồng CTV chuẩn Việt Nam (VietQR NAPAS 247 CSV) + Quốc tế (USDT TRC-20 NOWPayments).

👉 **Subscribe or request a Master License Key / Đăng ký hoặc yêu cầu Khóa Bản Quyền Master:** [https://sophia.agencyos.network/pricing](https://sophia.agencyos.network/pricing)
