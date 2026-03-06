# Usage Metering Gap Analysis Report

**Date:** 2026-03-07
**Researcher:** Subagent (researcher)
**Status:** Production Readiness Audit

---

## Executive Summary

The usage metering system is **PARTIALLY IMPLEMENTED**. Core tracking infrastructure is production-ready, but critical gaps remain in instrumentation, idempotency, license-to-customer linkage, and debugging capabilities.

**Overall Score: 5.5/10**

---

## 1. Current Schema Design

### 1.1 UsageEventInput Fields (Defined)
```
✅ userId: string
✅ licenseKeyHash: string
✅ licenseNonce: string
✅ service: AiService
✅ endpoint: string
✅ action: string
✅ tokensInput?: number
✅ tokensOutput?: number
✅ creditsUsed: number
✅ requestId?: string
✅ modelName?: string
✅ tierAtRequest: string
✅ statusCode?: number
✅ errorMessage?: string
✅ responseTimeMs?: number
✅ createdAt?: number
```

### 1.2 UsageEventDB Fields (Storage Schema)
```
✅ user_id
✅ license_key_hash
✅ license_nonce
✅ service_name
✅ endpoint
✅ action
✅ tokens_input
✅ tokens_output
✅ credits_used
✅ request_id
✅ model_name
✅ tier_at_request
✅ status_code
✅ error_message
✅ response_time_ms
✅ created_at
```

### 1.3 Missing Fields vs Requirements
| Requirement | Status | Notes |
|-------------|--------|-------|
| tenant_id | ✅ Covered | `user_id` field |
| license_key | ✅ Covered | `license_key_hash` (hashed) |
| timestamp | ✅ Covered | `created_at` (Unix) |
| resource_type | ⚠️ Partial | Combines `service_name` + `action` |
| quantity | ⚠️ Partial | `credits_used` approximates |
| external_customer_id | ❌ MISSING | No Stripe/Polar customer linkage |

---

## 2. Current Tracking Instrumentation

### 2.1 Instrumented Services

| Service | File | Coverage |
|---------|------|----------|
| **HeyGen** | `heygen-client.ts` | ✅ Full - createVideo tracked on success/fail |
| **ElevenLabs** | `text-to-speech-generator.ts` | ✅ Full - text_to_speech tracked on success/fail |
| **OpenRouter** | `script-generator.ts` | ✅ Full - chat_completion tracked with tokens |

### 2.2 Event Emission Pattern
```
Pattern: Event emitted AFTER API call (not before)
✅ Success path tracked
✅ Error path tracked (creditsUsed = 0)
 disabling: Yes (silent fail on tracking errors)
```

### 2.3 NOT Instrumented Services
| Area | Status | Risk |
|------|--------|------|
| API Gateway rate limiting | ❌ MISSING | No visibility into blocked requests |
| Batch video processing | ❌ MISSING | Heavy usage untracked |
| Image generation | ❌ MISSING | No cost tracking |
| Storage uploads | ❌ MISSING | Supabase storage costs untracked |
| Third-party API retries | ❌ MISSING | Duplicate tracking possible |
| Admin manual operations | ❌ MISSING | Bypasses metering entirely |

### 2.4 Compute Time Tracking
```
 CURRENT:
 ✅ Response time captured (responseTimeMs)
 ❌ CPU time not tracked
 ❌ No GPU time tracking
 ❌ No memory usage metrics
 ❌ No concurrent request tracking

 IMPACT: Cannot bill based on actual resource consumption
```

---

## 3. Current Ingestion Pipeline

### 3.1 Storage Architecture
```
Database: Supabase PostgreSQL
Table: usage_events
Pattern: Write-only append (ledger-style)
Time-series indexing: Yes (created_at index present)
```

### 3.2 Message Queue / Buffer
```
CURRENT: ❌ NO MESSAGE QUEUE
All writes go directly to database

RISKS:
- Database saturation on high traffic
- No retry mechanism for failed writes
- No batching optimization
- No off-peak load shifting
```

### 3.3 Idempotency Checks
```
CURRENT: ❌ NO IDEMPOTENCY

Missing:
- No request_id deduplication
- No idempotency key in schema
- No upsert logic
- Potential duplicate tracking on retries

RISK: Double-billing on transient failures
```

### 3.4 Batch Processing
```
EXISTING: ✅ /api/v1/usage endpoint
- Accepts array of records (max 1000)
- Quota cache per-license during batch
- Individual success/fail reporting

GAP: ❌ No scheduled batch hydration
- No cron job to handle offline usage
- No offline-first support
```

---

## 4. License Key Integration (Phase 2)

### 4.1 License Validation
```
✅ License nonce validated
✅ License existence check
✅ License revoked status check
✅ Tier derived from license

APS:
❌ No Stripe customer ID linkage
❌ No Polar subscription ID linkage
❌ No external billing system sync
```

### 4.2 Usage Event → License Linkage
```sql
CURRENT SCHEMA:
usage_events.license_nonce → raas_licenses.nonce

MISSING FIELDS IN raas_licenses:
- stripe_customer_id (TEXT)
- polar_subscription_id (TEXT)
- external_tier_mapping (JSON)
```

### 4.3 Customer Cross-Reference
```
❌ No migration to add customer_id columns
❌ No webhook handler updating customer mapping
❌ No query joining usage + customer data for billing export
```

---

## 5. Debug/Logging Capabilities

### 5.1 Local Debug Log
```
EXISTING:
⚠️  {logger}.debug() used in tracker.ts
❌ No dedicated debug log file
❌ No debug mode toggle (ENV var)
❌ No local-only logging for development

RECOMMENDATION:
Add DEBUG_USAGE_METERING=true env var
Write to /tmp/usage_debug_*.log in dev mode
```

### 5.2 Mock Endpoint for Testing
```
❌ NO MOCK ENDPOINT

Missing:
- /api/usage/mock (generates test data)
- /api/usage/debug/inject (manual injection)
- /api/usage/debug/clear (reset for testing)

This makes development/testing difficult.
```

### 5.3 Query for Verification
```sql
-- Current query to check tracking:
SELECT * FROM usage_events
WHERE created_at > (EXTRACT(EPOCH FROM NOW()) - 3600)::integer
ORDER BY created_at DESC LIMIT 10;

-- MISSING: Query for untracked services
-- MISSING: Query for duplicate request_ids
```

---

## Critical Gaps Summary

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| 🔴 P0 | Idempotency key | Double-billing risk | Low |
| 🔴 P0 | No Stripe/Polar linkage | Cannot reconcile billing | Medium |
| 🟠 P1 | API Gateway tracking | Revenue leakage | Medium |
| 🟠 P1 | No message queue | Scale limits | High |
| 🟡 P2 | Mock endpoint | Development friction | Low |
| 🟡 P2 | Debug logging | Troubleshooting difficulty | Low |

---

## Recommendation Priority

### Phase 1 (Before Production)
1. Add idempotency key + request_id deduplication
2. Add Stripe/Polar customer_id columns to raas_licenses
3. Instrument API Gateway to track rate-limited requests

### Phase 2 (Scalability)
4. Implement Kafka/PubSub message queue
5. Add scheduled batch hydration cron
6. Add compute time tracking (CPU/memory/GPU)

### Phase 3 (Better DevX)
7. Create mock/debug endpoints
8. Add ENV-based debug logging
9. Query pagination for large exports

---

## Unresolved Questions

1. **License-to-Customer**: Should we use Stripe customer_id or Polar subscription_id as the primary external identifier? Or both?

2. **Idempotency Strategy**: Should we use request_id from client, or generate server-side UUID?

3. **Message Queue**: Should we use Supabase Queue, PostgreSQL LISTEN/NOTIFY, or external service (Kafka/PubSub)?

4. **Batch Ingestion Source**: Who will use `/api/v1/usage`? Is there an external billing system or edge function ingest?

5. **Compute Time Tracking**: Do we need actual GPU/CPU metrics, or is response_time_ms sufficient for billing?

---

*End of Report*
