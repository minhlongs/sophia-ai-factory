# Definitive Operator Checklist for YELLOW -> GREEN Certification

**Document ID:** SOPHIA-CERT-GRAD-001  
**Status:** READY FOR OPERATOR SIGN-OFF  
**Current Production Certification:** YELLOW - CONDITIONAL  
**Target Certification:** GREEN - CUSTOMER HANDOVER READY  
**Verified Production Baseline:** Cloudflare Workers SHA `b77c5504` (Deployed: 2026-09-10T10:57:35Z)  
**Production Domain:** `https://sophia.agencyos.network`  

---

## 1. Executive Summary / Tong Quan

Sophia AI Factory has achieved full architectural and code-level verification under the CF-direct doctrine. All five prior P0 blockers (pricing contradictions, Setup Wizard advancement leakage, founder email anti-spoofing, BYOK provider factory alignment, and mission preflight validation) have been permanently resolved with 107/107 automated customer-readiness tests passing across 15 test suites and zero TypeScript errors.

The platform is certified as **YELLOW - CONDITIONAL** solely because final production validation requires human-authorized live execution:
1. Entering a funded live `fal.ai` API key to execute a real AI generation job.
2. (Optional) Executing an on-chain cryptocurrency payment ($199 Starter tier).

This checklist specifies the exact steps, URL routes, expected HTTP status codes, and Cloudflare D1 SQL verification queries required for the Operator or Founder to transition the platform from **YELLOW** to **GREEN**.

---

## 2. Established Core Invariants / Cac Bat Bien He Thong

The following foundational invariants are permanently enforced at SHA `b77c5504`:

| Invariant | Implementation File | Verification Evidence |
|---|---|---|
| **1. Pricing Truth** | `src/seed/config/tiers/unified-limits.ts` | Single canonical source `UNIFIED_TIERS`: Starter ($199), Growth ($399), Premium ($799), Master ($4,999). Zero discrepancies across billing queries, NOWPayments gateway, PayOS, and promo appliers. |
| **2. Setup Wizard Fail-Closed Gate** | `src/tree/components/setup-wizard/steps/index.tsx` | Step 4 strictly blocks progression if credential saving fails. Finish step dynamically queries `/api/setup-wizard/readiness` from live database state. |
| **3. Founder Anti-Spoofing** | `src/seed/auth/founder-bootstrap.ts` | Any account matching `FOUNDER_EMAIL` with unverified email (`emailVerified === false`) is denied admin role and MASTER tier elevation. |
| **4. BYOK Capability Model** | `src/seed/ai/capability-model.ts` | Dynamic bidirectional mapping from configured API keys (`fal-ai`, `replicate`, `openrouter`, `elevenlabs`, `d-id`) to capabilities (`AI_IMAGE`, `AI_VIDEO`, `AI_TEXT`, `AI_AUDIO`, `AVATAR`). |
| **5. 7-Gate Mission Preflight** | `src/forest/mission/preflight-check.ts` | Fail-closed preflight check enforces 7 gates: Authentication, Workspace Ownership, Entitlement Quota, Provider Credentials, AI Capability, R2 Storage, and Queue Capacity before calling external AI APIs. |

---

## 3. Operator Verification Matrix / Bang Kiem Tra Van Hanh

| Item | Gate Description | Target Surface / URL | Expected Code | Verification Query / Mechanism | Status |
|---|---|---|---|---|---|
| **P-01** | Production Version Match | `GET /api/version` | HTTP 200 | `shortSha: "b77c5504"` | [PASS] VERIFIED |
| **P-02** | System Health Check | `GET /api/health` | HTTP 200 | Healthy payload | [PASS] VERIFIED |
| **P-03** | Locale Auth Routing | `GET /login` -> `GET /vi/login` | HTTP 307 -> 200 | Clean redirect to localized UI | [PASS] VERIFIED |
| **P-04** | Pricing Display Truth | `GET /vi/pricing` | HTTP 200 | Displays $199 / $399 / $799 / $4,999 | [PASS] VERIFIED |
| **OP-01** | Live fal.ai Key & Capability | `POST /api/setup/save` | HTTP 200 | D1 table `user_api_keys` contains AES-GCM-256 payload | READY FOR OPERATOR |
| **OP-02** | Live Image Mission Execution | `/vi/dashboard/missions/new` | HTTP 200 / 201 | D1 table `media_jobs` records completed job with R2 key | READY FOR OPERATOR |
| **OP-03** | Safe Support Bundle Export | `GET /operations` | HTTP 200 | Downloaded JSON has all secrets masked as `[REDACTED]` | READY FOR OPERATOR |
| **OP-04** | (Optional) Crypto Payment | NOWPayments Portal | HTTP 200 | D1 table `payment_events` contains processed IPN record | OPTIONAL FOR OPERATOR |

---

## 4. Step-by-Step Operator Action Guide / Huong Dan Chi Tiet

### Action 1: Live fal.ai API Key Test & First Mission Execution

This action proves that the customer onboarding journey succeeds end-to-end with real AI generation.

#### Step 1.1: Register or Sign In to a Test Account
1. Open browser to: `https://sophia.agencyos.network/vi/register` (or `/en/register`).
2. Register a clean email address (e.g., `operator-canary@agencyos.network`).
3. Confirm successful login and redirection to dashboard.
4. **Expected Result:** HTTP 200 on login, session cookie created.

#### Step 1.2: Configure fal.ai API Key via Setup Wizard
1. Navigate to: `https://sophia.agencyos.network/vi/setup`.
2. Proceed through Step 1 (Language & Business Model).
3. At Step 2 (API Keys / BYOK), input a valid, funded fal.ai key in the `fal-ai` field.
4. Advance through Step 3 (Branding).
5. At Step 4 (Blueprint Selection), click **Luu va Tiep tuc (Save and Continue)**.
6. Verify that saving succeeds and the interface advances to Step 5 (Finish / Ready Scorecard).
7. Confirm that the scorecard displays:
   - fal-ai: **HOAT DONG (ACTIVE)**
   - Kha nang he thong: **AI_IMAGE (Kha dung / Available)**
   - San sang chay Mission: **CO (YES)**

#### Step 1.3: Verify Key Storage in Cloudflare D1
Execute via terminal or Cloudflare console to ensure encrypted storage:
```bash
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT user_id, provider, created_at, length(encrypted_key) as key_bytes FROM user_api_keys WHERE provider = 'fal-ai' ORDER BY created_at DESC LIMIT 1;"
```
**Expected Output:**
- `provider`: `fal-ai`
- `key_bytes`: > 28 bytes (verifying non-empty AES-GCM-256 initialization vector, ciphertext, and auth tag)

#### Step 1.4: Execute Live AI Generation Mission
1. Navigate to: `https://sophia.agencyos.network/vi/dashboard/missions/new`.
2. Select the **Text to Image** template.
3. Enter prompt: `Hyper-realistic luxury perfume bottle on volcanic stone, dramatic rim lighting, 8k resolution`.
4. Click **Khoi chay Mission (Run Mission)**.
5. The 7-gate preflight check executes:
   - Gate 1: Authentication (Valid session)
   - Gate 2: Workspace Ownership (Tenant validated)
   - Gate 3: Entitlement Quota (Sufficient MCU balance)
   - Gate 4: Provider Credential (fal-ai key present)
   - Gate 5: Capability Resolution (AI_IMAGE enabled)
   - Gate 6: Storage Target (Cloudflare R2 accessible)
   - Gate 7: Queue State (Workers runtime clear)
6. Observe execution completes within 5-15 seconds.
7. Verify that generated image appears in the UI gallery with full preview and download capability.

#### Step 1.5: Verify Job and Storage Records in D1
```bash
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT id, user_id, type, status, storage_key, bucket, latency_ms, created_at, completed_at FROM media_jobs WHERE type = 'image' ORDER BY created_at DESC LIMIT 1;"
```
**Expected Output:**
- `status`: `completed`
- `storage_key`: Non-null string (e.g., `media/images/...`)
- `bucket`: `sophia-ai-factory-opennext-cache` (or configured R2 media bucket)
- `latency_ms`: > 0 (measuring real provider round-trip time)
- `completed_at`: Valid UNIX timestamp >= `created_at`

---

### Action 2: (Optional) On-Chain Cryptocurrency Payment Test

This action proves that automated blockchain billing and entitlement activation work end-to-end.

#### Step 2.1: Initiate Starter Tier Checkout
1. Navigate to: `https://sophia.agencyos.network/vi/pricing`.
2. Locate the **Starter** plan ($199 / month).
3. Click **Nang cap (Upgrade)** to open the NOWPayments crypto invoice.
4. Select cryptocurrency (e.g., USDT TRC-20, BTC, or ETH).
5. Complete payment from test wallet.

#### Step 2.2: Verify Webhook Receipt and Atomic Idempotency in D1
```bash
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT id, event_id, event_type, processed, created_at FROM payment_events WHERE event_id LIKE 'nowpayments_%' ORDER BY created_at DESC LIMIT 3;"
```
**Expected Output:**
- `event_type`: `payment.finished`
- `processed`: `1`

#### Step 2.3: Verify Subscription and MCU Credit Entitlement
```bash
npx wrangler d1 execute sophia-raas-db --remote --command="SELECT s.user_id, s.tier, s.status, s.plan, c.credits_remaining FROM subscriptions s LEFT JOIN mcu_credit_balances c ON s.user_id = c.user_id WHERE s.user_id = '<TEST_USER_ID>';"
```
**Expected Output:**
- `tier`: `BASIC` (or Starter tier)
- `status`: `active`
- `credits_remaining`: Entitlement loaded according to tier specification (50 MCU Starter baseline)

---

### Action 3: Verify Safe Diagnostics Export

1. Navigate to: `https://sophia.agencyos.network/vi/operations`.
2. Click **Tai goi chan doan an toan (Download Safe Diagnostic Bundle)**.
3. Open the downloaded JSON file in any text editor.
4. Inspect contents:
   - Confirm that API keys are completely redacted as `[REDACTED]`.
   - Confirm that user IDs are masked (`usr_...`).
   - Confirm that zero database connection strings, bearer tokens, or PII are exposed.

---

## 5. Graduation Criteria (YELLOW -> GREEN Sign-Off)

To execute final graduation to **GREEN - CUSTOMER HANDOVER READY**, the following criteria must be signed off:

- [ ] **Criteria 1 (Live Key Verification):** Operator has executed Action 1 using a live fal.ai key; Setup Wizard scorecard displayed ACTIVE; 1 image mission completed successfully.
- [ ] **Criteria 2 (Artifact Storage Verification):** Generated image is verified in Cloudflare R2 bucket with matching `media_jobs` row in D1.
- [ ] **Criteria 3 (Sanitization Verification):** Diagnostic export verified to contain 100% redacted secrets and masked user identifiers.
- [ ] **Criteria 4 (Optional Payment Verification):** Either on-chain checkout was verified via Action 2, OR manual billing waiver was recorded by the Founder.

---

## 6. Sign-Off Authorization / Bien Ban Nghiem Thu

When the above checks are completed by the operator, fill out this section to finalize certification:

```
===================================================================
SOPHIA AI FACTORY — GREEN GRADUATION CERTIFICATE
===================================================================
Current Production SHA: b77c5504
Deploy Timestamp:       2026-09-10T10:57:35Z
Verified By (Operator): ___________________________
Date of Verification:   ___________________________
Action 1 (fal.ai Job):  [ ] PASS  [ ] FAIL
Action 2 (Payment IPN): [ ] PASS  [ ] WAIVED BY FOUNDER
Action 3 (Diagnostics): [ ] PASS  [ ] FAIL

FINAL VERDICT:          [ ] GREEN — FULL HANDOVER ACCEPTED
Operator Signature:     ___________________________
===================================================================
```
