# Webhooks for RaaS Users — Sophia AI Factory

**Decision context:** User RaaS không Telegram cần generic event delivery channel. Chọn Option C (webhooks) per Mekong "Cửu Biến" — adapt to terrain, không lock-in 1 channel.

## Scope

Generic outbound webhooks: user provides URL, Sophia POSTs signed JSON payloads on subscribed events. User integrates với Slack/Discord/Zapier/n8n/own-server tự do.

## Events (initial set — 5)

| Event | Source | Payload |
|---|---|---|
| `mission.completed` | Inngest function generate-campaign | `{missionId, tenantId, status, videoUrl?, durationSec, costUsd}` |
| `video.ready` | Render pipeline finalize | `{videoId, missionId, tenantId, r2Key, publicUrl?, durationSec}` |
| `payment.received` | NOWPayments IPN handler | `{tenantId, amountUsd, tier, paymentId, paidAt}` |
| `error.threshold` | Error digest cron | `{tenantId, errorCount24h, severity, sampleErrors[]}` |
| `affiliate.discovered` | affiliate-scout output | `{tenantId, affiliateId, network, commissionPct, productName}` |

## Architecture

```
Event source (Inngest/route/cron)
   │
   ├─→ existing handler (DB write, etc.)
   │
   └─→ webhook-emitter.emit(event, payload, tenantId)
         │
         ├─→ load endpoints from D1 (where tenant + event subscribed + active)
         │
         └─→ for each: enqueue to delivery queue
                │
                └─→ webhook-sender (async)
                      ├─→ HMAC-SHA256 signature (header X-Sophia-Signature)
                      ├─→ POST with timeout 10s
                      ├─→ log attempt → webhook_attempts
                      └─→ on fail: exponential backoff retry (5 attempts, 30s/2m/10m/1h/6h)
```

## Phases

| # | Scope | Files | Risk | Status |
|---|---|---|---|---|
| 1 | Schema + core delivery + REST CRUD | ~8 files | LOW | pending |
| 2 | Event emission + Dashboard UI | ~10 files | MEDIUM | pending |
| 3 | Tests + verify + deploy | n/a | LOW | pending |

## Security

- HMAC SHA256 signature with per-endpoint secret
- HTTPS-only URLs (reject http:// in form validation)
- Timeout 10s per request
- Max 5 retry attempts, then dead-letter
- Tenant-scoped (user can only see/edit own webhooks)
- Rate limit per tenant: max 50 endpoints, max 1000 deliveries/hour

## Modularization

- `src/lib/webhooks/registry.ts` — CRUD endpoints (D1)
- `src/lib/webhooks/signer.ts` — HMAC signing
- `src/lib/webhooks/sender.ts` — HTTP POST + timeout
- `src/lib/webhooks/emitter.ts` — public API: `emit(event, payload, tenantId)`
- `src/lib/webhooks/retry.ts` — backoff schedule
- `src/lib/webhooks/__tests__/*.test.ts`
- `src/app/api/v1/webhooks/route.ts` — POST list/create
- `src/app/api/v1/webhooks/[id]/route.ts` — GET/PATCH/DELETE
- `src/app/api/v1/webhooks/[id]/test/route.ts` — fire test event
- `src/app/[locale]/dashboard/integrations/webhooks/page.tsx` — UI list
- `src/app/[locale]/dashboard/integrations/webhooks/webhook-form.tsx` — add/edit
- `migrations/0078-webhooks.sql`

## Constraints

- Edge runtime safe (Cloudflare Workers)
- No new deps (use Web Crypto API for HMAC)
- TypeScript strict, zero `any`
- Tests required before deploy
- D1 client sync (no await on `createServerClient()`)
- CI/CD blocked at GH user level — manual `npm run deploy:full`
