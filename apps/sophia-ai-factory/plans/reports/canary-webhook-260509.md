# Canary Webhook Documentation

**Created:** 2026-05-09 (Wave 13 G-I3)
**Scope:** Outbound signing format, inbound verification flow, legacy deprecation, monitoring.

---

## 1. Outbound Webhook Signing Format

All Sophia AI Factory outbound webhooks use a **Stripe-style signed header**:

```
X-Sophia-Signature: t=<unix_ts>,v1=<hmac-sha256-hex>
```

Where:
- `t` = Unix timestamp in **seconds** at signing time.
- `v1` = HMAC-SHA256 hex of `${t}.${raw_json_body}` using the endpoint secret.

### Canonical Implementation

```typescript
import { signWebhook } from '@/lib/webhooks/signature';

const header = await signWebhook(rawBody, endpointSecret);
// e.g. "t=1746748800,v1=deadbeef..."
```

The `signWebhook` function is the single source of truth. All outbound signing MUST route through it.

### Header Names by Context

| Context | Header |
|---|---|
| SOP webhooks | `X-Sophia-Signature` |
| Alert notifications | `X-Signature` + `X-Timestamp` (legacy split; see §4) |
| Generic outbound | `X-Sophia-Signature` |

---

## 2. Replay Window (5-Minute Skew Tolerance)

All inbound verification enforces a **300-second (5-minute) replay window** by default:

```
|now - t| <= toleranceSec (default 300)
```

- Signatures older than 5 minutes are **rejected** (replay attack prevention).
- Clock skew up to 5 minutes is tolerated.
- The tolerance is configurable via `VerifyOptions.toleranceSec`.

Inbound systems MUST validate the timestamp before processing any webhook payload.

---

## 3. Inbound Verification Flow

All inbound verification routes through `verifyWebhook()` from `@/lib/webhooks/signature`:

```typescript
import { verifyWebhook } from '@/lib/webhooks/signature';

const isValid = await verifyWebhook(rawBody, signatureHeader, endpointSecret, {
  toleranceSec: 300,  // 5 min default
  acceptLegacy: true, // bare-hex accepted during deprecation window
});
```

### Verification Steps (internal)

1. Parse `t=<ts>,v1=<hex>` from the signature header.
2. Check `|now - ts| <= toleranceSec`. Reject if stale.
3. Recompute HMAC-SHA256 over `${ts}.${rawBody}`.
4. Constant-time compare expected vs provided `v1`.
5. Return `true` only if all checks pass.

### Callers (post-Wave 13 migration)

| File | Function | Notes |
|---|---|---|
| `src/lib/sop/webhook-hmac.ts` | `verifySignature()` | Delegates to `verifyWebhook` |
| `src/lib/alerts/webhook-notification-signature.ts` | `verifyWebhookSignature()` | Reconstructs unified header from split header |
| `src/seed/security/webhook-validator.ts` | `verifyWebhookSignature()` | Delegates to `verifyWebhook` |

---

## 4. Migration Plan: Legacy Bare-Hex Deprecation

### Background

Before Wave 11 G3, some callers produced **bare-hex** signatures (64-char HMAC-SHA256 over the raw body, no timestamp prefix). This format has no replay protection.

### Current Status (Wave 13)

- `verifyWebhook()` accepts bare-hex via `acceptLegacy: true` (default `true`).
- All migrated callers pass `acceptLegacy: true` for 1 release cycle.
- Bare-hex has **no timestamp**, so replay protection is not applied to those calls.

### Deprecation Timeline

| Date | Action |
|---|---|
| 2026-05-09 (Wave 13) | Migration complete. All callers use `verifyWebhook`. `acceptLegacy=true`. |
| 2026-05-23 (~14 days) | Remove `acceptLegacy=true` from all callers. Bare-hex rejected. |
| 2026-06-06 | Remove legacy branch from `verifyWebhook` source. |

**14-day window** gives external webhook senders time to update their signing logic to the `t=<ts>,v1=<hex>` format.

### Outbound Format Change for Alert Notifications

`src/lib/alerts/webhook-notification-signature.ts` previously sent:
```
X-Signature: v1=<hex>
X-Timestamp: <ts>
```

Post-Wave 13, `generateWebhookSignature()` now returns the unified header:
```
X-Signature: t=<ts>,v1=<hex>
X-Timestamp: <ts>
```

The `X-Timestamp` header is preserved for legacy receiver compatibility.
Receivers SHOULD migrate to parsing the full `X-Signature` header.

---

## 5. Monitoring: Canary Alert Protocol

### Log Failed Signatures Separately

All inbound signature failures MUST be logged with a distinct tag for canary alerting:

```typescript
// Recommended pattern in route handlers:
const valid = await verifyWebhook(body, sig, secret);
if (!valid) {
  logger.warn('[webhook-sig-fail]', { endpoint, reason: 'invalid_signature' });
  return new Response('Unauthorized', { status: 401 });
}
```

The `[webhook-sig-fail]` tag enables log-based alerting (e.g., Cloudflare Logpush + alert rule).

### Canary Thresholds

| Signal | Threshold | Action |
|---|---|---|
| Signature failures per 5 min | > 10 | PagerDuty / Slack alert |
| Replay-rejected requests per 5 min | > 5 | Investigate possible attack |
| Legacy bare-hex requests per day | > 0 after 2026-05-23 | Sender migration required |

### Metrics to Track

- `webhook.verify.pass` — count of successful verifications
- `webhook.verify.fail` — count of failures (subdivide by: stale, invalid-sig, malformed)
- `webhook.verify.legacy_accepted` — count of bare-hex accepted (monitor for zero post-deprecation)

### Implementation Note

Use Cloudflare Workers Analytics Engine or structured logging to emit these metrics. Grep pattern for existing failures:

```bash
# In Cloudflare Logpush exports:
grep 'webhook-sig-fail' workers.log | wc -l
```

---

## 6. Security Considerations

- **Timing-safe comparison**: `verifyWebhook` uses `crypto.subtle.verify()` which is constant-time by spec (Web Crypto API).
- **Secret rotation**: Rotate `endpointSecret` via CF Worker Secret update. During rotation, run dual-verify (old + new) for 1 period.
- **Secret length**: All generated secrets are 32 bytes (256 bits) of random entropy — `generateWebhookSecret()`.
- **Bare-hex legacy risk**: The legacy path has no replay protection. Monitor `webhook.verify.legacy_accepted` and enforce deprecation.

---

## 7. Reference

- Unified API: `src/lib/webhooks/signature.ts` — `signWebhook`, `verifyWebhook`, `VerifyOptions`
- Wave 11 G3 report: `plans/reports/integrity-260509-0447-wave-11-g3.md`
- Wave 13 G-I3 report: `plans/reports/i3-260509-wave-13-webhook-totp.md`
