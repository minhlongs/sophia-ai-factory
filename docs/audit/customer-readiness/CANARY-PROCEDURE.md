# Controlled Production Canary Procedure — Sophia AI Factory

**Date**: 2026-09-10  
**Status**: ACTIVE — CONTROLLED EXECUTION SPECIFICATION  
**Target Environment**: Production (`https://sophia.agencyos.network`)  
**Product Doctrine**: No-Code / No-Tech (CEO-Operable)  

---

## 1. Objective & Philosophy

This document defines the strict, real-world Canary verification procedure for Sophia AI Factory. In accordance with the Supreme Customer-Readiness Repair mandate:

1. **No Simulated Data**: No mocked HTTP handlers in production, no synthetic user creation bypassing the UI, no simulated payment fulfillment.
2. **Strict Boundary Delimitation**: Distinguish between code-verified capability and real external transaction authorization.
3. **Fail-Closed Protection**: Any failure during verification immediately aborts the run without granting unearned access.

---

## 2. Canary Test Journey Stages & Status

| Stage | Step Description | Channel / Surface | Verification Status | Gate Requirement |
|:---:|---|---|:---:|---|
| **S1** | **User Authentication & Email Safety** | `/vi/register` & `/vi/login` | **VERIFIED (LOCAL) / UNVERIFIED (PROD)** | Real email signup. Zero auto-promotion to admin without email verification. |
| **S2** | **Pricing Transparency** | `/vi/pricing` & `/en/pricing` | **VERIFIED** | Canonical tiers: Starter ($199), Growth ($399), Premium ($799), Master ($4,999). |
| **S3** | **Setup Wizard Fail-Closed Execution** | `/vi/setup` | **VERIFIED (CODE & TESTS)** | Saves credentials; failure blocks advancement at step 4. Dynamic readiness derived from server. |
| **S4** | **BYOK Credential Vaulting** | `/api/user/byok` & Setup Wizard | **VERIFIED (ENCRYPTION)** | AES-GCM-256 envelope encryption. Replicate & fal.ai supported. |
| **S5** | **AI Capability Mapping** | `/api/setup-wizard/readiness` | **VERIFIED** | Providers map dynamically to capabilities (`AI_TEXT`, `AI_IMAGE`, `AI_VIDEO`, etc.). |
| **S6** | **Creative Mission Preflight** | `src/forest/mission/preflight-check.ts` | **VERIFIED (7 GATES)** | Checks: Auth, Ownership, Entitlement, Credential, Capability, Storage, Queue. |
| **S7** | **First Mission Execution (fal.ai)** | `startMissionExecution` / Inngest | **BLOCKED — LIVE CREDENTIAL REQUIRED** | Requires real user fal.ai API key entered in Setup Wizard. |
| **S8** | **Real Payment & Entitlement** | NOWPayments Checkout / IPN | **BLOCKED — REAL MONEY AUTHORIZATION REQUIRED** | Requires authorized real cryptocurrency transaction ($199+). |
| **S9** | **Usage & Cost Metering** | `/settings/usage` | **VERIFIED (ACCOUNTING)** | Null-cost preservation; no deceptive $0 costs for unmetered runs. |
| **S10** | **Safe Support & Diagnostics** | `/operations` & Diagnostic Bundle | **VERIFIED (REDACTION)** | 100% regex redaction of keys, tokens, database URLs, and PII. |

---

## 3. Delimitation of Blocked Items

### A. Real Payment Fulfillment
- **Status**: `BLOCKED — REAL MONEY AUTHORIZATION REQUIRED`
- **Rationale**: Real money payment ($199 for BASIC tier via NOWPayments USDT/BTC/ETH) cannot and must not be initiated or fabricated by an automated agent. 
- **Required Action**: Founder or authorized billing representative must initiate a real test checkout from the live pricing UI and approve the blockchain transaction.
- **Verification Rule**: Verify that the D1 `payment_events` table registers the `finished` webhook state, `meta.changes === 1`, and the user's tier is elevated to `BASIC` with 50 MCU allocated.

### B. Real Provider Credential (fal.ai Key)
- **Status**: `BLOCKED — FOUNDER/CUSTOMER MUST SUPPLY LIVE API KEY`
- **Rationale**: Automated test suites use isolated mocks or test environment variables. In production, customers own their API keys under BYOK doctrine.
- **Required Action**: Founder/Operator must log into the production UI as a regular user, navigate to Setup Wizard (`/vi/setup`), and enter a valid, funded fal.ai API key.
- **Verification Rule**: Verify key persistence in `user_api_keys`, then verify that `/api/setup-wizard/readiness` reports `AI_IMAGE` capability enabled.

---

## 4. Operator Action Checklist for Production Canary

The following 6-step checklist must be performed by the Founder or QA Operator to complete the real-world canary:

1. **Step 1: Sign up a clean canary account**
   - Navigate to: `https://sophia.agencyos.network/vi/register`
   - Register a fresh email address (e.g., `canary-test@agencyos.network`).
   - Confirm that the account starts with `BASIC` tier and standard user role (NOT admin).

2. **Step 2: Enter Setup Wizard**
   - Access: `https://sophia.agencyos.network/vi/setup`
   - Step through to Step 2 (API Keys).
   - Enter a valid fal.ai API key (`fal_...`).
   - Advance to Step 4 (Blueprint). Click Save.
   - Verify: Save succeeds and advances to Finish Step.
   - Verify: Scorecard dynamically displays "fal-ai: ACTIVE" and "Capability: AI_IMAGE".

3. **Step 3: Run Preflight Check & First Mission**
   - Access: `https://sophia.agencyos.network/vi/dashboard/missions/new`
   - Select "Text to Image" template using fal.ai.
   - Click "Run Mission".
   - Verify that 7-gate preflight passes and Inngest job is dispatched.

4. **Step 4: Verify Artifact in Dashboard**
   - Check the mission output gallery.
   - Confirm image is stored in Cloudflare R2 and served via signed/secure URL.

5. **Step 5: Test Safe Diagnostic Export**
   - Access: `https://sophia.agencyos.network/vi/operations`
   - Click "Tải gói chẩn đoán an toàn" (Download Safe Diagnostic Bundle).
   - Inspect the downloaded JSON file.
   - Confirm: fal.ai key is redacted as `[REDACTED]`, user ID is masked (`usr_***`), no internal secrets appear.

6. **Step 6: Optional Payment Validation (Real Money)**
   - Navigate to `/vi/pricing`.
   - Select Starter plan ($199).
   - Complete crypto checkout on NOWPayments test/live portal.
   - Confirm instant entitlement in `/settings/usage`.
