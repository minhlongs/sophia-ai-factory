# Edge Tracking — Setup Guide

Cookieless S2S affiliate tracking via Cloudflare Workers.

## Architecture

```
track.sophia-ai-factory.agencyos-openclaw.workers.dev/api/track/[id]
  → CF Workers edge (0ms lookup)
  → D1 write (click + IP hash)
  → 302 → destination_url
```

## DNS Subdomain Setup

1. Add CNAME record in Cloudflare DNS:
   ```
   track.sophia-ai-factory.agencyos-openclaw.workers.dev → sophia-ai-factory.workers.dev
   ```
2. Cloudflare automatically issues TLS for the subdomain (orange-cloud enabled).

## Wrangler Routes Configuration

In `wrangler.toml`, add custom route:

```toml
[[routes]]
pattern = "track.sophia-ai-factory.agencyos-openclaw.workers.dev/*"
zone_name = "sophia-ai-factory.agencyos-openclaw.workers.dev"
```

Or use the Cloudflare dashboard: Workers → Triggers → Add Custom Domain.

## S2S Postback URL Format

Each affiliate network calls your postback URL when a conversion fires:

```
POST https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/{network}
Content-Type: application/json

{
  "link_id": "Abc12345",      # Required — 8-char tracking link ID
  "external_id": "conv-xyz",  # Network's own conversion ID (optional)
  "amount_usd": 29.99         # Commission amount (optional)
}
```

### Per-Network Postback URL Examples

| Network | Postback URL |
|---|---|
| Binance Link | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/binance-link` |
| Bybit | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/bybit` |
| Bitget | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/bitget` |
| OKX | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/okx` |
| PartnerStack | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/partnerstack` |
| Generic | `https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/postback/generic` |

## Privacy Design

- Raw IP is **never stored** — only `sha256(ip + tenant_secret)`
- GDPR compliant: no PII in database
- `TRACKING_HMAC_SECRET` env var drives the per-tenant hash key

## Signature Verification

Network-specific HMAC signature verification is enabled by default.
Disable via `POSTBACK_SIGNATURE_VERIFICATION_ENABLED=false` env var (dev/staging only).

Implementation: `src/land/postback/hmac-verifier.ts`
Route integration: `src/app/api/postback/[network]/route.ts`
