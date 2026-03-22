# Code Review: Wave 2 RaaS Features

**Date:** 2026-03-21
**Reviewer:** code-reviewer
**Scope:** 8 files (4 new, 4 updated) — ~530 LOC

---

## Overall Assessment

Code quality tốt, cấu trúc rõ ràng, consistent pattern giữa các endpoint. Tuy nhiên có **2 critical** và **3 high** issues cần fix trước khi merge.

---

## CRITICAL Issues

### C1. Cancel endpoint: Race condition cho phép double-refund

**File:** `app/api/v1/missions/[id]/cancel/route.ts` lines 57-95

Luồng fetch-then-update **không atomic**. Hai request cancel đồng thời:

1. Request A: fetch mission -> status='queued', mcu_reserved=100
2. Request B: fetch mission -> status='queued', mcu_reserved=100
3. Request A: update status='failed' -> success
4. Request B: update status='failed' -> success (no WHERE on status!)
5. Both refund 100 MCU -> **double refund**

**Root cause:** Line 84 update chỉ filter `eq('id', id)`, thiếu `eq('status', 'queued')` hoặc `in('status', CANCELLABLE_STATUSES)`.

**Fix:**
```typescript
// Line 76-84: Add status guard to UPDATE
const { data: updated, error: updateErr } = await db
  .from('missions')
  .update({
    status: 'failed',
    error_message: 'Cancelled by API consumer',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq('id', id)
  .in('status', CANCELLABLE_STATUSES)  // <-- atomic guard
  .select('id')
  .single();

if (updateErr || !updated) {
  return NextResponse.json(
    { error: 'Mission already cancelled or in progress' },
    { status: 409 }
  );
}
```

Ly tuong hon nua: wrap update + credit_mcu_balance trong 1 Postgres transaction (RPC).

### C2. SSRF bypass: `172.` prefix check quá rộng và thiếu kiểm tra

**Files:** `app/api/v1/missions/route.ts` line 131, `lib/raas/webhook-delivery.ts` line 21

`h.startsWith('172.')` blocks `172.0.0.0/8` nhung RFC 1918 chi dinh `172.16.0.0/12` (172.16.x.x - 172.31.x.x). Dang block luon `172.32.x.x` - `172.255.x.x` la public IP.

Nghiem trong hon: **Thieu check:**
- IPv6 private ranges (`fc00::`, `fe80::`, `::ffff:127.0.0.1`)
- `0.0.0.0`, `0177.0.0.1` (octal), `2130706433` (decimal IP)
- DNS rebinding: hostname resolve to internal IP after validation
- `.local` domains, link-local (`169.254.x.x` beyond metadata)

**Fix:**
```typescript
function isPrivateIp(hostname: string): boolean {
  // Reject obvious private patterns
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(hostname)) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  if (hostname === '169.254.169.254') return true;

  // Parse octets for RFC 1918
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}
```

Luu y: DNS rebinding van la risk. Production nen dung server-side DNS resolution + check IP after resolve, hoac dung allowlist domain.

---

## HIGH Priority

### H1. `verifySignature` crash khi `receivedHmac` khong phai hex hop le

**File:** `lib/raas/webhook-hmac.ts` line 67-70

`Buffer.from(receivedHmac, 'hex')` se tao buffer rong hoac sai length neu input khong phai valid hex. `timingSafeEqual` throw `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` khi buffer length khac nhau.

**Fix:**
```typescript
const receivedBuf = Buffer.from(receivedHmac, 'hex');
const expectedBuf = Buffer.from(expectedHmac, 'hex');

if (receivedBuf.length !== expectedBuf.length) return false;

return crypto.timingSafeEqual(receivedBuf, expectedBuf);
```

### H2. Rate limiter: In-memory state lost on serverless cold start

**File:** `lib/raas/rate-limiter.ts`

Vercel serverless: moi request co the chay tren instance khac nhau. `Map` in-memory chi song trong 1 instance -> rate limit bi bypass bang cach hit nhieu instances.

**Impact:** Rate limit hau nhu vo hieu tren serverless deployment.

**Fix options (chon 1):**
1. **Redis** (Upstash): atomic `INCR` + `EXPIRE`, shared across instances
2. **Supabase RPC**: `check_rate_limit(key_id, limit)` voi `FOR UPDATE` lock
3. **Vercel KV**: Upstash Redis wrapper, zero config

In-memory van co gia tri nhu first-line defense, nhung khong the la sole mechanism.

### H3. POST /missions: Balance check + debit la TOCTOU race

**File:** `app/api/v1/missions/route.ts` lines 153-170

```
Check balance >= mcuCost     // Time of Check
... other code ...
Debit balance                // Time of Use
```

Hai request dong thoi co the pass balance check nhung ca hai debit -> balance am.

**Fix:** `debit_mcu_balance` RPC **phai** co internal check `WHERE balance >= p_amount` va return error neu insufficient. Neu RPC da implement nhu vay -> remove client-side balance check (hoac giu nhu informational pre-check). Verify RPC code.

---

## MEDIUM Priority

### M1. `extractApiKey` duplicated across 5 files

**Files:** Tat ca route files co cung function `extractApiKey`

**Fix:** Move to shared utility, e.g. `lib/raas/auth-helpers.ts`:
```typescript
export function extractApiKey(request: NextRequest): string | null { ... }
```

### M2. Console.error in production leaks internal info

**Files:** All route files dung `console.error` voi full error object.

Line 75: `console.error(\`GET /api/v1/missions/${id} error:\`, err);`

Production log co the chua stack traces, SQL errors, internal paths.

**Fix:** Log error.message only hoac dung structured logger voi redaction.

### M3. Webhook delivery: Missing idempotency key

**File:** `lib/raas/webhook-delivery.ts`

Consumer nhan duplicate webhook neu retry delivers successfully nhung response bi timeout truoc khi ghi `delivered_at`. Nen them `X-Webhook-Id` header (UUID) de consumer co the deduplicate.

### M4. `status` query param khong duoc validate

**File:** `app/api/v1/missions/route.ts` line 64

`params.get('status')` truyen thang vao `.eq('status', status)` — cho phep query bat ky status string nao. Nen validate against known statuses.

### M5. `limit` param NaN handling

**File:** `app/api/v1/missions/route.ts` line 55

`parseInt('abc')` -> `NaN`, `Math.min(50, NaN)` -> `NaN`. Supabase `.limit(NaN)` behavior khong xac dinh.

**Fix:** `const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') ?? '20', 10) || 20));`

---

## LOW Priority

### L1. `remaining` off-by-one

**File:** `lib/raas/rate-limiter.ts` line 78

`remaining` duoc tinh truoc khi push timestamp (line 64), roi tru 1 (line 78). Correct ve logic nhung hoi confusing. Nen tinh sau push de code ro rang hon.

### L2. Cleanup timer potential memory concern

**File:** `lib/raas/rate-limiter.ts` line 23-34

`setInterval` 5 phut la hop ly. Nhung neu co 100K+ unique keys (DDoS), Map van lon truoc khi cleanup chay. Consider max entries cap.

### L3. Missing `Retry-After` header on 429 responses

Standard practice la them `Retry-After` header khi return 429. Hien tai chi co rate limit headers.

---

## Positive Observations

1. **HMAC signing** dung `timingSafeEqual` — dung chuan
2. **Webhook SSRF** co defense o ca 2 layers (route validation + delivery check)
3. **API key storage** chi luu hash, prefix cho display — best practice
4. **Timestamp binding** trong HMAC signature chong replay — tot
5. **Fire-and-forget** async execute trigger co `.catch()` — khong block response
6. **Refund on insert failure** (missions/route.ts line 190-193) — defensive
7. **AbortSignal.timeout** cho webhook fetch — tranh hang indefinitely
8. **Org ownership** verified on all queries via `.eq('org_id', auth.orgId)` — IDOR protected

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix cancel endpoint race condition — add status guard to UPDATE
2. **[CRITICAL]** Fix SSRF IP validation — correct 172.x range, add IPv6/octal checks
3. **[HIGH]** Add length check before `timingSafeEqual` in `verifySignature`
4. **[HIGH]** Plan Redis-based rate limiter for production (Upstash)
5. **[HIGH]** Verify `debit_mcu_balance` RPC has internal balance guard
6. **[MEDIUM]** Extract `extractApiKey` to shared module (DRY)
7. **[MEDIUM]** Add webhook idempotency key
8. **[MEDIUM]** Validate `status` and `limit` query params

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 8 |
| LOC | ~530 |
| Critical issues | 2 |
| High issues | 3 |
| Medium issues | 5 |
| Low issues | 3 |
| DRY violations | 1 (extractApiKey x5) |

---

## Unresolved Questions

1. `debit_mcu_balance` RPC: co internal `WHERE balance >= amount` check khong? Neu khong -> CRITICAL race condition cho balance am.
2. `credit_mcu_balance` RPC: co idempotency guard (e.g. unique constraint on subscription_id) de chong double-refund o DB level khong?
3. Rate limiter: da co plan chuyen sang Redis/Upstash cho production chua? In-memory chi hoat dong tren single instance.
4. Webhook signing secret: per-org hay global? Code fallback to `WEBHOOK_SIGNING_SECRET` env var — neu tat ca org dung chung 1 secret thi org A co the forge webhook cho org B.
