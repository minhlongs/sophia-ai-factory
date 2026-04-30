# Phase 09 — Affiliate Offer Engine

## Status: PENDING (after Phase 8)

## Goal
Multi-network offer fetcher + Shlink-style cloaking + revenue tracking.

## Networks (priority order, VN-first)
1. **AccessTrade VN** (primary)
2. TikTok Shop Affiliate
3. ClickBank
4. Awin
5. Amazon Associates

## Deliverables
- [ ] Offer DB schema (`offers`, `offer_links`, `clicks`, `conversions`)
- [ ] Cloak service (Shlink clean-room TS port — see SYNTHESIS unresolved Q3)
- [ ] Click tracker (cookie + UTM + fingerprint)
- [ ] Conversion webhook handlers per network
- [ ] FTC disclosure auto-injection

## Files
- `apps/sophia-ai-factory/lib/affiliate/networks/{accesstrade,tiktok,clickbank,awin,amazon}.ts`
- `apps/sophia-ai-factory/lib/affiliate/cloak.ts`
- `apps/sophia-ai-factory/app/api/affiliate/click/[id]/route.ts`

## Risk: High — AGPL workaround for RefearnApp + ToS compliance per network

## Effort: 7-10 days
