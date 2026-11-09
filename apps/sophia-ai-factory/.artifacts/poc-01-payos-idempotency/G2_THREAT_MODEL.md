# Gate G2 — Threat Model & Red-Team Security Mitigation (`PoC 01` & `REPORT 09`)

## 1. Phạm vi Đánh giá / Scope (VI / EN)

- **VI:** Mô hình đe dọa bảo mật cho `Blueprint 05` (Xác thực chữ ký PayOS HMAC-SHA256 + Chống phát lại trên D1), `Gate G8` (Cô lập đa người thuê tại `/api/realtime/token` và truy vấn D1), `Blueprint 01` (Bảo vệ khóa BYOK AES-256-GCM), và `Blueprint 04` (Chống xuất bản ngầm trái phép lên TikTok/YouTube).
- **EN:** Threat model covering `Blueprint 05` (PayOS Web Crypto HMAC-SHA256 verification + D1 replay ledger), `Gate G8` (multi-tenant isolation on `/api/realtime/token` and D1 queries), `Blueprint 01` (AES-256-GCM BYOK protection), and `Blueprint 04` (TikTok/YouTube human-approved publishing compliance).

---

## 2. Ma trận Đe dọa & Biện pháp Giảm thiểu / Threat Matrix (`SEC-01` .. `SEC-09`)

| Threat ID | Threat Vector | Severity | Implementation Mitigation in Sophia AI Factory | Verification Gate |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Cross-Tenant Data Leakage (`/api/realtime/token`, D1, R2) | CRITICAL | Server-authenticated `getCurrentUser()` session binding; `verifyRealtimeSubscription()` rejects mismatched `organizationId` (`CROSS_TENANT_ACCESS_DENIED`); R2 keys prefixed with `orgs/{org_id}/`. | Gate G8 (`red-team-sec-01-09-auditor.ts`) |
| **SEC-02** | BYOK Secret Extraction & Error Stream Leakage | CRITICAL | AES-256-GCM encryption before D1 persistence; `redactSensitiveSecrets()` strips `sk-*`, `Bearer *`, and hex keys from all logs/streams; `ValidationReceipt` never echoes raw keys. | Gate G6 / G8 (`byok-validation-receipt.ts`) |
| **SEC-03** | Indirect Prompt Injection from Competitor/Web Research | HIGH | Untrusted research text is isolated from tool-calling privileges; research steps emit strict Zod-validated JSON only and cannot invoke publish or payment tools. | Gate G6 (`red-team-sec-01-09-auditor.ts`) |
| **SEC-04** | Payment Webhook Forgery, Test-Ping Spoofing & Parallel Replay | CRITICAL | Alphabetical key-sorted Web Crypto `HMAC-SHA256` with constant-time comparison (`payos-signature-verifier.ts`), PayOS connectivity test-ping filter (`isTestPing: true` -> HTTP 200 without tier upgrade), and atomic `INSERT INTO payment_events_ledger ... ON CONFLICT DO NOTHING` lock before Inngest dispatch. | Gate G7 (`research-experiments-runner.ts` EXP-03) |
| **SEC-05** | Unauthorized Background Publishing & Platform ToS Ban | CRITICAL | Mandatory `step.waitForEvent('video/publish.approved')`; TikTok `/creator_info/query/` check with no default privacy pre-selection; YouTube `status.containsSyntheticMedia = true` and `private` default on unverified OAuth clients. | Gate G6 (`social-publish-compliance-gate.ts` EXP-02) |
| **SEC-06** | Supply-Chain & Commercial License Contamination | HIGH | Enforced SIVI whitelist (`Kokoro-82M` Apache-2.0, `faster-whisper` MIT, `HyperFrames` Apache-2.0, `Remotion` free tier `<= 3` seats); rejects `InsightFace` non-commercial weights (`-det facemesh` required) and AGPL/GPL-3.0 dependencies. | Gate G1 (`sivi-scorecard.ts`) |
| **SEC-07** | Affiliate Self-Referral & Premature Payout Fraud | HIGH | Mandatory 30-day `ESCROW_HOLD` on verified PayOS/NOWPayments conversions (`affiliate-escrow-guard.ts`); blocks self-referrals and requires explicit founder approval before payout release. | Gate G7 (`red-team-sec-01-09-auditor.ts`) |
| **SEC-08** | Untrusted Media & Cloudflare D1 1 MiB Row Overflow | MEDIUM | Rejects `data:*;base64,` payloads in D1 columns (`d1-media-uri-guard.ts`); enforces R2 URI + SHA-256 hash storage and normalizes images to JPEG/WebP (`PNG` blocked for TikTok photo posts). | Gate G5 (`red-team-sec-01-09-auditor.ts`) |
| **SEC-09** | Residual PII & OAuth Tokens After Account Revocation | MEDIUM | Hard-delete purge contract (`org-data-purge-guard.ts`) wipes D1 BYOK keys, OAuth tokens, and `orgs/{org_id}/` R2 objects upon tenant data deletion request. | Gate G8 (`red-team-sec-01-09-auditor.ts`) |
