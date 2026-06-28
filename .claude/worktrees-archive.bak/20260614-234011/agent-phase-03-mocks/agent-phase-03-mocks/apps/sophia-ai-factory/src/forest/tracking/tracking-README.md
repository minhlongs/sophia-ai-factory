# Edge Tracking — Setup Guide

Cookieless S2S affiliate tracking via Cloudflare Workers.

## Architecture

```
track.sophia.agencyos.network/api/track/[id]
  → CF Workers edge (0ms lookup)
  → D1 write (click + IP hash)
  → 302 → destination_url
```

## DNS Subdomain Setup

1. Add CNAME record in Cloudflare DNS:
   ```
   track.sophia.agencyos.network → sophia-ai-factory.workers.dev
   ```
2. Cloudflare automatically issues TLS for the subdomain (orange-cloud enabled).

## Wrangler Routes Configuration

In `wrangler.toml`, add custom route:

```toml
[[routes]]
pattern = "track.sophia.agencyos.network/*"
zone_name = "sophia.agencyos.network"
```

Or use the Cloudflare dashboard: Workers → Triggers → Add Custom Domain.

## S2S Postback URL Format

Each affiliate network calls your postback URL when a conversion fires:

```
POST https://sophia.agencyos.network/api/postback/{network}
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
| Binance Link | `https://sophia.agencyos.network/api/postback/binance-link` |
| Bybit | `https://sophia.agencyos.network/api/postback/bybit` |
| Bitget | `https://sophia.agencyos.network/api/postback/bitget` |
| OKX | `https://sophia.agencyos.network/api/postback/okx` |
| PartnerStack | `https://sophia.agencyos.network/api/postback/partnerstack` |
| Generic | `https://sophia.agencyos.network/api/postback/generic` |

## Privacy Design

- Raw IP is **never stored** — only `sha256(ip + tenant_secret)`
- GDPR compliant: no PII in database
- `TRACKING_HMAC_SECRET` env var drives the per-tenant hash key

## TODO: Signature Verification

Network-specific HMAC signature verification is not yet implemented.
Current security: unguessable base62 link IDs.

When ready, enable via `POSTBACK_SIGNATURE_VERIFICATION_ENABLED=true` env var.
Implementation location: `src/app/api/postback/[network]/route.ts`
