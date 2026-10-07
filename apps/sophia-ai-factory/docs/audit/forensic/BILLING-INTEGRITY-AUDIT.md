# SOPHIA AI FACTORY — BILLING & PAYMENT INTEGRITY AUDIT
**Document Version:** 1.0.0  
**Scope:** `src/land/billing/`, `src/app/api/webhooks/nowpayments/`, `src/seed/config/tiers/`  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  

---

## 1. Executive Summary

Sophia AI Factory processes cryptocurrency payments via NOWPayments IPN webhooks and manages customer subscriptions, top-ups, and tier upgrades.

### Billing Integrity Verdict: **GREEN (Strictly Guarded)**

---

## 2. Canonical Pricing Authority

- **Single Source of Truth:** `src/seed/config/tiers/tier-configs.ts`
- **Tier Configuration:**
  - `BASIC`: Free Tier (Community support, 50 MCU/mo)
  - `PREMIUM`: \$49.00 / mo (500 MCU/mo, Full Niche Video Engine)
  - `ENTERPRISE`: \$199.00 / mo (2,500 MCU/mo, Multi-channel syndication)
  - `MASTER`: \$499.00 / mo (Unlimited campaigns, Priority Rendering, Founder privileges)
- **Invariant:** All checkout invoice generators, webhook validators, and UI tier cards derive pricing exclusively from `TIER_CONFIGS`.

---

## 3. Webhook Security & Idempotency Architecture

### 3.1 HMAC-SHA512 Signature Verification
- **Header:** `x-nowpayments-sig`
- **Secret:** Cloudflare Secret `NOWPAYMENTS_IPN_SECRET`
- **Algorithm:** Keys in the payload are sorted lexicographically (`ksort`), serialized to JSON, and hashed using HMAC-SHA512.
- **Fail-Closed:** Missing or invalid signature returns HTTP 400 immediately before any database interaction.

### 3.2 Atomic Locking & Deduplication
- **D1 Atomic Lock:**
  ```sql
  INSERT INTO payment_events (
    event_id, 
    event_type, 
    payload, 
    processed, 
    created_at
  ) VALUES (?1, ?2, ?3, 0, ?4)
  ON CONFLICT(event_id) DO NOTHING;
  ```
- **Lock Evaluation:** If `meta.changes === 0`, the IPN event has already been recorded or is currently being processed. The route immediately returns `{ received: true, deduplicated: true }`.

### 3.3 Amount Mismatch & Underpayment Guardrails
- **File:** `src/land/billing/nowpayments-ipn-finished.ts`
- **Underpayment Rejection:**
  ```typescript
  const UNDERPAYMENT_THRESHOLD = 0.98; // 2% tolerance for crypto gas fluctuations
  if (actuallyPaid < expectedPrice * UNDERPAYMENT_THRESHOLD) {
    logger.warn('[Billing] Underpayment detected. Refusing tier activation.', ...);
    return { success: false, reason: 'UNDERPAYMENT' };
  }
  ```
- **Amount Mismatch Threshold:**
  ```typescript
  const AMOUNT_MISMATCH_THRESHOLD = 0.01;
  if (Math.abs(ipn.price_amount - expectedPrice) > expectedPrice * AMOUNT_MISMATCH_THRESHOLD) {
    logger.error('[Billing] Price amount mismatch against canonical tier catalog', ...);
    return { success: false, reason: 'PRICE_TAMPERING' };
  }
  ```

---

## 4. Adversarial Test Scenarios

| Attack Vector | Vulnerability Pre-Condition | Verified Defense | Result |
|---|---|---|---|
| **Replay Attack** | Attacker re-sends valid completed IPN payload | D1 `payment_events` unique constraint on `event_id` | HTTP 200 Deduplicated; no double credit |
| **Spoofed Webhook Signature** | Attacker sends forged IPN from rogue IP | HMAC-SHA512 verification fails | HTTP 400 Rejected |
| **Underpayment Exploitation** | Attacker pays \$1.00 on a \$49.00 PREMIUM invoice | Underpayment check (`< 0.98 * expectedPrice`) halts activation | Tier remains unchanged |
| **Price Tampering in Client** | Client modifies requested amount to \$0.01 | Backend checks `ipn.price_amount` against `TIER_CONFIGS[tier].priceUsd` | Tampering detected; activation aborted |
