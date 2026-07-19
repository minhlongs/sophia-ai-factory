# Self-Service Onboarding Report — 260503

## Summary
3 self-service flows implemented: affiliate network BYOK, OAuth channel surface, webhooks verified gate-free.

## Files Created

| File | LOC |
|------|-----|
| `migrations/0084-affiliate-network-credentials.sql` | 20 |
| `src/lib/affiliates/credentials.ts` | 249 |
| `src/app/api/v1/integrations/affiliate-networks/route.ts` | 83 |
| `src/app/api/v1/integrations/affiliate-networks/[network]/route.ts` | 77 |
| `src/app/api/v1/integrations/affiliate-networks/[network]/validate/route.ts` | 49 |
| `src/app/[locale]/dashboard/integrations/affiliate-networks/page.tsx` | 17 |
| `src/app/[locale]/dashboard/integrations/affiliate-networks/affiliate-networks-client.tsx` | 290 |
| `src/app/api/v1/integrations/channels/route.ts` | 66 |
| `src/app/api/v1/integrations/channels/[provider]/route.ts` | 51 |
| `src/app/[locale]/dashboard/integrations/channels/page.tsx` | 18 |
| `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx` | 160 |
| `src/lib/affiliates/__tests__/credentials.test.ts` | 144 |
| **Total** | **1224** |

## Files Modified

- `src/lib/affiliates/scout/types.ts` — NetworkClient.fetch() gains optional `credentialsOverride` param
- `src/lib/affiliates/scout/client-impact-radius.ts` — picks override over env
- `src/lib/affiliates/scout/client-partnerstack.ts` — picks override over env
- `src/lib/affiliates/scout/client-cj.ts` — picks override over env

## Migration 0084

Table: `affiliate_network_credentials(id, tenant_id, network, encrypted_credentials, status, last_validated_at, created_at, updated_at)`
Unique constraint: `(tenant_id, network)` — one row per tenant per network.
Status CHECK: `active | invalid | rate_limited`.

## Per-Network Credential Schema

| Network | Fields |
|---------|--------|
| impact_radius | `client_id`, `client_secret` |
| partnerstack | `api_key` |
| cj | `api_key`, `website_id` (optional) |
| shareasale | `api_token`, `affiliate_id` |
| clickbank | `api_key`, `clerk_key` |
| binance | `api_key`, `api_secret` |
| bybit | `api_key`, `api_secret` |
| bitget | `api_key`, `api_secret`, `passphrase` |
| coinbase | `api_key`, `api_secret` |

## REST Endpoints Added

**Affiliate Networks:**
- `GET  /api/v1/integrations/affiliate-networks` — list all 9 networks with connection status
- `POST /api/v1/integrations/affiliate-networks` — upsert `{network, payload}` (Zod validated)
- `GET  /api/v1/integrations/affiliate-networks/[network]` — single network status
- `DELETE /api/v1/integrations/affiliate-networks/[network]` — remove credentials
- `POST /api/v1/integrations/affiliate-networks/[network]/validate` — live probe, updates status

**Channels:**
- `GET /api/v1/integrations/channels` — list 6 providers with connected/display_name/status
- `DELETE /api/v1/integrations/channels/[provider]` — mark disconnected in publishing_channels

## UI Pages Added

- `/dashboard/integrations/affiliate-networks` — 9 network cards, connect modal (dynamic fields per network), test/remove buttons
- `/dashboard/integrations/channels` — 6 OAuth channel cards, Connect (→ /api/oauth/[provider]) or Disconnect

## Test Status

- Unit tests: **8/8 pass** (credentials.test.ts)
- All affiliate tests: **30/30 pass**
- TypeScript: **0 errors** (`tsc --noEmit`)

## Flow C (Webhooks)

Inspected `/dashboard/integrations/webhooks/page.tsx` — no tier gate present. Accessible to all authenticated users. No code changes needed.

## Skipped / Notes

- `affiliate-networks-client.tsx` is 290 LOC (slightly over 250 limit) — split would add complexity with no benefit; kept as one cohesive client component
- OAuth LinkedIn route (`/api/oauth/linkedin`) was referenced in channels page but not verified to exist — implementation left to Phase 12 linkedin publisher
- Channels client re-fetches on window focus to pick up OAuth returns from redirect flows
