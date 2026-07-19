# Postback HMAC + Affiliate Scout Org Isolation

**Date:** 260504  
**Status:** COMPLETE

## Files Modified

- `src/lib/postback/hmac-verifier.ts` — CREATED (99 lines)
- `src/lib/postback/network-secret-resolver.ts` — CREATED (81 lines)
- `src/app/api/postback/[network]/route.ts` — UPDATED (original 91 → 205 lines)
- `src/app/api/cron/affiliate-scout/route.ts` — UPDATED (minor: TenantRow + subscriptions query)

## Tasks Completed

- [x] Web Crypto HMAC-SHA256 hex + base64 verifiers (no Node.js crypto)
- [x] `resolveNetworkSecret(db, networkSlug, linkId)` — tenant-scoped secret lookup via tracking_links → affiliate_network_credentials
- [x] Network-specific signature locations: X-Signature (binance/bybit), pstack-signature (partnerstack), query signature (awin), cbreceipt field (clickbank), X-Tiktok-Signature (tiktok_shop)
- [x] `POSTBACK_SIGNATURE_VERIFICATION_ENABLED` env flag (default '1'; '0' = dev bypass with warning)
- [x] 401 + error_log on invalid signature; never records conversion
- [x] Fail-closed on internal verification errors (500)
- [x] Pass-through if no credentials stored for tenant+network (baseline: link_id unguessability)
- [x] Affiliate scout subscriptions query: added `org_id IS NOT NULL` + `.filter(r => r.org_id)` guard
- [x] Removed unused `last_run_at` from TenantRow

## Key Decisions

- **Schema reality:** `affiliate_network_credentials` uses `tenant_id` + `network`, credentials are AES-GCM encrypted. Schema does NOT have `network_name` column — query uses `network` column.
- **Network-to-DB mapping:** `binance-link` → `binance`, `bybit` → `bybit`, etc. via `NETWORK_SLUG_TO_DB` map.
- **Secret field per network:** binance/bybit → `api_secret`; partnerstack/cj → `api_key`; clickbank → `clerk_key`; impact_radius → `client_secret`.
- **No credentials = pass-through** (not 401): prevents breaking live postbacks before tenants configure BYOK credentials. Logged as warning.
- **ClickBank MD5 fallback:** Web Crypto doesn't support MD5 natively; HMAC-SHA256 only. MD5 legacy not implemented.

## Tests

- TypeScript: 0 errors (`npx tsc --noEmit`)
- Build: ✓ compiled (`npm run build`)
- Vitest: 2796 passed / 31 skipped (280 files)

## Unresolved Questions

1. **ClickBank legacy MD5:** The task mentions "fall back to legacy if SHA256 fails" but Web Crypto has no MD5 support. Current impl tries SHA256 only (clerk_key HMAC). If ClickBank network sends MD5 signatures, they'll fail — operator must verify which ClickBank webhook type is in use.
2. **awin secret:** Awin is not in `affiliate_network_credentials` DB schema (no `awin` enum value). The resolver returns null → pass-through. If awin HMAC is needed, a migration must add `awin` to the network CHECK constraint.
3. **tiktok_shop secret field:** TikTok Shop uses `app_secret` but the credentials table has no `tiktok_shop` network. Same as awin — pass-through until migration adds it.
4. **Postback without link_id:** If affiliate network sends postback before a tracking link is clicked (no link_id resolvable), secret lookup returns null → pass-through. Consider network-level shared secret via env var as fallback.
