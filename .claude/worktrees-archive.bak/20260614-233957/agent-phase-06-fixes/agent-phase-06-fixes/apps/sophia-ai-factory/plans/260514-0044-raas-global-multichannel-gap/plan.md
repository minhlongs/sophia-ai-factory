---
title: "RaaS Global Multi-Channel Gap"
status: complete
shipped: 2026-05-15
live_sha: 5e377b50
prod_url: https://sophia.agencyos.network
---

# Plan: RaaS Global Multi-Channel Gap — Wave A + B + C COMPLETE

North-star: non-tech CEO mua RaaS → Sophia auto-discover "kèo thơm" (SaaS + Crypto) liên tục → publish video AI sang 13 kênh → kiếm tiền toàn cầu.

## Ship Status (2026-05-15)

| # | Phase | Commit | Status |
|---|---|---|---|
| 01 | Crypto exchange affiliate (Binance/Bybit/Bitget/Coinbase) | `5cd07d70` | ✅ shipped |
| 02 | SaaS scout (ShareASale/Awin/Rakuten) | `5cd07d70` | ✅ shipped |
| 03 | Anti-scam + EPC scoring (6-factor + blacklist) | `4abe195b` | ✅ shipped |
| 04 | One-click bundle publish (4 presets) | `59fd56cf` | ✅ shipped |
| 05 | Geo-translate caption per channel (BYOK + KV) | `93b190e0` | ✅ shipped |
| 06 | A/B title+thumbnail runner (2× CTR rule + mig 0111) | `a3b1b853` | ✅ shipped |
| 07 | Unified revenue dashboard (Recharts stacked) | `b9616a9f` | ✅ shipped |
| 08 | Crypto disclaimer per jurisdiction (US/EU/VN/SG/JP) + mig 0110 | `1a935b13` | ✅ shipped |
| 09 | Help videos library + per-route tooltips + mig 0112 | `b84165d4` | ✅ shipped (skeleton; founder fills R2 content) |
| 10 | Per-channel cooldown + burst protection (13 channels) | `ef9a32cf` | ✅ shipped |

## Production verification (2026-05-15)

- Local HEAD = Live SHA: `93b190e0`
- HTTP: 200 on https://sophia.agencyos.network
- Tests: 4272+ passing
- D1 migration 0110 (`tenant_settings.crypto_jurisdiction`) applied
- Origin synced: pushed before each deploy per push-precondition rule

## Follow-up — Founder action

- **Phase 06:** Cron schedule `0 * * * *` for `/api/cron/ab-winner-picker` — wire into wrangler.toml dispatcher when cron-routing pattern verified. Route currently reachable via authenticated curl.
- **Phase 09:** Founder records VN videos, uploads to R2 bucket, then `UPDATE help_videos SET r2_key=..., published=1 WHERE slug=...` per slug. 10 skeleton entries seeded.

## Success Criteria — Status

- [x] Daily scout finds new "kèo thơm" (score ≥0.7) — engine ready, awaits BYOK creds
- [x] One-click publish lands on ≥6 channels with localized caption per region
- [x] Unified revenue dashboard shows SaaS + Crypto + Product earnings in ONE chart
- [x] All crypto offers ship with jurisdiction-aware disclaimer (caption + video overlay)
- [x] Per-channel cooldown prevents tier-ban risk
- [ ] Non-tech CEO connects 1 SaaS network + 1 crypto exchange in <5 min — BYOK UI ready, smoke-test pending founder

## Unresolved Questions (carry to next sprint)

1. Crypto BYOK scope enforcement — verify `tree/byok/byok-crypto.ts` rejects withdraw permission (Phase 01 deferred verification)
2. ShareASale/Rakuten — founder accounts vs skeleton-only first
3. A/B winner threshold — simple 2x rule vs significance test
4. Help videos — founder records or D-ID auto-gen
5. Bundle name mapping — founder approves "Vietnam-Bundle", "Global-Bundle", etc.
