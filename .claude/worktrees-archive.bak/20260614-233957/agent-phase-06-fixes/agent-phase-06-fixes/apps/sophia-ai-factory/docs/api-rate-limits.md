# API Rate Limits

**Document ID:** API-LIMITS-001
**Effective Date:** 2026-05-20
**Owner:** Platform
**Source of truth:** `src/seed/security/sql-rate-limiter.ts` → `RATE_LIMITS` constant.

> All limits are **per-identifier per-window** (identifier = `user_id` for authenticated routes, `ip` for anonymous). Enforcement is D1-backed (`rate_limit_buckets` table).

---

## 1. Default Rate Limits (all tiers)

| Bucket | Max requests | Window | Applies to |
|---|---:|---|---|
| `api` | 100 | 60 s | General authenticated API routes |
| `webhook` | 1000 | 60 s | Inbound webhooks (NOWPayments IPN, Telegram, etc.) |
| `auth` | 10 | 60 s | `/api/auth/*` sign-in / sign-up / password reset |
| `admin` | 50 | 60 s | `/api/admin/*` destructive routes |
| `discovery` | 30 | 60 s | `/api/discovery/*` (OpenRouter cost exposure → stricter) |

**Note:** These limits are intentionally NOT differentiated by tier today. Tier separation lives at the **quota layer** (monthly video count, campaign count, etc.) — see `src/seed/config/tiers/`.

---

## 2. Per-Tier Quotas (monthly, separate from rate limit)

| Tier | Monthly campaigns | Channels | Other |
|---|---:|---:|---|
| BASIC (Starter) | 10 | 1 | Standard support 24h |
| PREMIUM (Growth) | 50 | 3 | Priority support 12h |
| ENTERPRISE (Premium) | unlimited | unlimited | Custom integrations, dedicated AM, 4h response |
| MASTER | unlimited (lifetime) | unlimited | VIP forever, 2h response, monthly strategy calls |

Quotas reset on calendar-month boundary (00:00 UTC on the 1st).
Source: `apps/sophia-ai-factory/src/seed/config/tiers/unified-limits.ts`.

---

## 3. Response Format on Throttle

When a bucket exceeds its limit, the route returns:

```http
HTTP/2 429 Too Many Requests
Content-Type: application/json
Retry-After: <seconds-until-window-resets>

{
  "error": "rate_limit_exceeded",
  "bucket": "api",
  "retryAfter": 47,
  "limit": 100,
  "windowSeconds": 60
}
```

---

## 4. ENTERPRISE / MASTER Custom Limits

ENTERPRISE and MASTER tiers may request **bucket-specific overrides** by contacting `support@mekongmind.com`. Custom limits land in the `rate_limit_overrides` table (one row per user × bucket). The middleware reads overrides ahead of defaults.

**Common ENTERPRISE asks supported today:**
- `api` raised to 500/min
- `discovery` raised to 100/min (with separate OpenRouter budget cap)

**Process:** support ticket → ops adds override row → user notified. SLA: 1 business day.

---

## 5. Customer-Owned External API Limits

Because Sophia is **BYOK** (customer brings their own API keys), the following limits are determined by the customer's plan with the upstream provider — Sophia cannot raise these:

| Service | Free-tier limit | Paid notes |
|---|---|---|
| OpenRouter | Varies per model; check openrouter.ai/limits | Per customer's OpenRouter account |
| ElevenLabs | 10k chars/month free | Per customer's ElevenLabs plan |
| D-ID | 5 min/month free | Per customer's D-ID plan |

When a customer's upstream key 429s, Sophia surfaces the upstream error verbatim in the campaign run log so the customer can upgrade their own plan.

---

## 6. Operator Tuning

To change a default limit:
1. Edit `RATE_LIMITS` in `src/seed/security/sql-rate-limiter.ts`
2. Build + deploy via `npm run deploy:full`
3. New limits apply to bucket rotations going forward (existing buckets unaffected until window expires)

Limits-config changes do NOT require D1 migration.

---

## 7. Unresolved

- ENTERPRISE custom-limit catalog not yet surfaced in dashboard (currently manual support ticket only — track as P2)
- No per-route override (only per-bucket); if `/api/admin/promo-codes` needs stricter than 50/min, requires new bucket
