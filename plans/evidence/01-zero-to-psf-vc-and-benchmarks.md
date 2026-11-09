# Sophia AI Factory — Evidence Vault 01: Zero-to-PSF VC Narrative, Open-Core Benchmarks & Data Room Index
# Kho Bằng Chứng 01: Câu Chuyện Gọi Vốn Zero→PSF, Đối Sánh Open-Core & Danh Mục Phòng Dữ Liệu

**Prepared / Ngày lập:** 2026-11-09  
**Blueprint Steps Covered / Các bước Blueprint:** Step 17 (VC Narrative), Step 20 (Open-Core Benchmarks), Step 21 (Evidence-Backed Data Room)  
**Truthful Stage Baseline / Nền tảng sự thật:** `Zero → Problem-Solution Fit (PSF)` · `mrr_usd: 0` · `paying_customers: 0` (`.mekong/company.json`)

---

## 1. Step 17 — Stage-Truthful VC & Strategic Narrative (Zero → PSF)

### 🇻🇳 Tóm tắt Tiếng Việt
Sophia AI Factory được định vị trung thực ở giai đoạn **Zero → Problem-Solution Fit (PSF)** với **0 khách hàng trả phí** và **$0 MRR** tại thời điểm kiểm toán (`.mekong/company.json`). Mọi mục tiêu doanh thu ($1M ARR) được ghi nhận là **định hướng chiến lược (directional goal)**, tuyệt đối không trình bày như doanh thu hiện hữu. Lợi thế cốt lõi gồm 3 trụ cột có thể kiểm chứng trực tiếp từ mã nguồn:
1. **Đòn bẩy PLG Open-Core (`Apache-2.0`):** Lõi tự triển khai (Self-Hosted Community Core) công khai trên GitHub giúp lập trình viên và kỹ thuật viên kiểm chứng toàn bộ cơ chế mã hóa khóa BYOK (`AES-256-GCM`) trước khi nâng cấp lên Cloud.
2. **Kinh tế đơn vị BYOK hiệu quả vốn (Capital-Efficient BYOK Economics):** Khách hàng tự nhập khóa AI (OpenRouter, ElevenLabs, HeyGen, D-ID) qua Setup Wizard. Sophia không gánh chi phí GPU/token bên thứ ba, duy trì biên lợi nhuận gộp mục tiêu 85–95% trên gói thuê bao phần mềm (`$199 / $399 / $799` mỗi tháng) và gói bàn giao `MASTER $4,999`.
3. **Kỷ luật kiến trúc 4 tầng & Cổng White-Label Đa Khách Hàng (`src/forest/admin/white-label`):** Kiến trúc `seed → tree → forest → land`, mỗi file thực thi `<= 130 LOC`, `0 :any`, và hệ thống quản lý subaccount cho Agency (`ENTERPRISE_MASTER`).

### 🌐 English Summary
Sophia AI Factory is disclosed truthfully at the **Zero → Problem-Solution Fit (PSF)** stage with **0 paying customers** and **$0 MRR** (`.mekong/company.json`). All ARR targets ($1M ARR) are explicitly framed as directional goals rather than forecast or run-rate figures. The investment thesis rests on three code-verifiable pillars:
1. **Apache-2.0 Open-Core PLG Wedge:** A public, inspectable Community Core builds developer trust around AES-256-GCM envelope-encrypted BYOK credential storage and seamless HMAC-signed workspace portability (`/api/open-core/portability`).
2. **BYOK Capital Efficiency:** Because end customers supply their own third-party AI compute keys (OpenRouter, ElevenLabs, HeyGen, D-ID), Sophia avoids variable AI inference COGS and targets 85–95% software subscription gross margins across `$199 / $399 / $799` monthly tiers and the `$4,999` Master handover license.
3. **Verifiable Engineering & White-Label Scale (`src/forest/admin/white-label`):** Strict 4-layer isolation (`seed → tree → forest → land`), `<= 130 LOC` per executable module, zero `:any`, and server-enforced commercial gates (`enforceCommercialFeatureForUser`).

---

## 2. Step 20 — Open-Core B2B Benchmarks & Custom Domain Boundary

### 🇻🇳 Đối sánh mô hình Open-Core B2B chuẩn mực
Sophia áp dụng ranh giới phân tách tính năng theo chuẩn của các công ty Open-Core B2B thành công (Supabase, PostHog, Cal.com, n8n): **không giới hạn thời gian hay cài bẫy (no artificial timebombs) trong bản Community**, và chỉ thu phí ở ranh giới **vận hành đa đối tác, tự động hóa đám mây 24/7 và thương hiệu riêng (White-Label / Custom Domains)**.

### 🌐 Open-Core B2B Benchmark Matrix

| Benchmark Company | Free Community Core (`Apache-2.0` / MIT / Fair-Code) | Paid Cloud & Enterprise Boundary | Sophia AI Factory Equivalent (`open-core-manifest.ts`) |
|---|---|---|---|
| **Supabase** | Self-hosted Postgres + Auth + Studio | Managed multi-project scaling, PITR backups, custom domains, SSO | Community: Single-workspace studio + BYOK Vault (`src/tree/byok`). Cloud/Enterprise: Managed 24/7 Inngest queues, Custom Domains (`src/tree/custom-domains`). |
| **PostHog** | Self-hosted product analytics & event capture | Group analytics, experimentation bandits, enterprise RBAC & audit logs | Community: Click/conversion attribution primitives. Cloud/Enterprise: Track B Sparse-Data Guarded Thompson Sampling MAB (`src/tree/monetization/paywall-mab-engine.ts`) + Merkle IPO Audit Vault (`src/tree/finance/merkle`). |
| **Cal.com** | Self-hosted scheduling core & individual booking | Team routing, white-label subaccounts, custom domain SSL, partner billing | Community: Individual `/ref/[code]` link generation. Cloud/Enterprise: Multi-tenant **Partner-Resell Kit** (`/[locale]/dashboard/affiliate`), Dual-Rail VietQR/USDT batch payouts (`src/land/payouts`), White-Label Agency Portal (`src/forest/admin/white-label`). |
| **n8n** | Local workflow builder & node execution | Cloud worker concurrency, credential sharing, enterprise governance | Community: Local video prompt & `/ask` 4-advisor router (`src/tree/ask`). Cloud: Direct Social Publisher Cockpit with anti-detection pacing (`src/forest/social-publisher`). |

---

## 3. Step 21 — Evidence-Backed Data Room Index

### 🇻🇳 Danh mục tài liệu đối chiếu trực tiếp từ mã nguồn (Zero Plausible Claims)
Mọi tuyên bố trong Data Room đều ánh xạ 1-1 tới tệp thực tế trong kho lưu trữ và có thể kiểm tra bằng lệnh `node scripts/verify-open-core-readiness.mjs`:

### 🌐 Verifiable Repository Exhibits

| Exhibit / Hạng mục | Canonical Repository Path | Verification Command / Method |
|---|---|---|
| **Truthful Company Profile & $0 MRR Baseline** | `.mekong/company.json` | `node scripts/verify-open-core-readiness.mjs` |
| **Dual-License Legal Authorities** | `LICENSE` (`Apache-2.0`) & `LICENSE-COMMERCIAL.md` | Root file existence & SHA verification |
| **13-Feature Open-Core Partition Manifest** | `apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts` | `npx vitest run src/seed/config/__tests__/open-core-readiness-contract.test.ts` |
| **Server-Side Commercial Gate Enforcer** | `apps/sophia-ai-factory/src/seed/config/enforce-commercial-feature-server.ts` | `npx vitest run src/seed/config/__tests__/enforce-commercial-feature-server.test.ts` |
| **25-Step Open-Core Catalog & Auditor** | `apps/sophia-ai-factory/src/seed/config/open-core-25-steps-catalog.ts` & `src/tree/open-core/open-core-25-steps-auditor.ts` | `npx vitest run src/tree/open-core/__tests__/open-core-25-steps-auditor.test.ts` |
| **Track B Sparse-Data Growth Guard & MAB Engine** | `apps/sophia-ai-factory/src/tree/growth/sparse-data-growth-guard.ts` & `src/tree/monetization/paywall-mab-engine.ts` | `npx vitest run src/tree/monetization/__tests__/paywall-mab-engine.test.ts` |
| **Pilot Unit Economics & Margin Modeler** | `apps/sophia-ai-factory/src/tree/finance/pilot-unit-economics.ts` | Verified BYOK unit economics engine (NOWPayments & PayOS only) |
| **Day-1 Master Handover Suite ($4,999)** | `apps/sophia-ai-factory/src/tree/handover` | 10-checkpoint infrastructure handover verifier |
| **Cryptographic Merkle Audit Vault** | `apps/sophia-ai-factory/src/tree/finance/merkle` | SHA-256 tamper-evident financial & operational ledger |
| **Multi-Tenant Partner-Resell Kit & Dual-Rail Payouts** | `apps/sophia-ai-factory/migrations/0500_affiliate_multi_tenant_isolation.sql` & `0501_affiliate_partners_tenant_isolation.sql` | `npx vitest run src/land/affiliates/actions/__tests__/workspace-partner-network-actions.test.ts` |
