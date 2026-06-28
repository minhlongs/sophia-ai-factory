---
title: Affiliate Catalog Public Refactor — Final Sign-Off
date: 2026-04-29
mode: /cook --auto --parallel
status: SHIPPED — 8.5/10 review, SHA match, 10 offers live
---

# Affiliate Catalog Public Refactor

**Predecessor:** [260429-2101-revenue-growth-parallel](../260429-2101-revenue-growth-parallel/final-signoff.md) (Phase C wrongly read tracking table)

## Problem

Phase C (commit 66b3309f) wired `/api/affiliate-discovery` to read from
`affiliate_offers_selected` — a per-user per-campaign tracking table with
FK to `users(id)` + `campaigns(id)`. Public exposure leaked which user
selected which offer for which campaign. Reviewer's "no PII" claim was wrong.

## Fix

New PUBLIC catalog table `affiliate_offers_catalog` (no FK), separate from
the private selection table. Route + page switched to new table. Seeded
10 real offers from top affiliate networks.

## Files Changed (5)

### NEW
- `migrations/0031-affiliate-offers-catalog.sql` — public catalog schema
- `migrations/0032-seed-affiliate-catalog.sql` — 10 curated offers

### MODIFIED
- `src/app/api/affiliate-discovery/route.ts` — query `affiliate_offers_catalog WHERE is_active=1`
- `src/app/api/affiliate-discovery/route.test.ts` — 6/6 pass for new schema + is_active filter
- `src/app/[locale]/affiliate-discovery/page.tsx` — render new fields (url anchor, category, description) with `rel="noopener noreferrer sponsored"` (FTC compliant)

## 10 Seeded Offers (Real Networks)

| Offer | Network | Commission |
|---|---|---|
| Bluehost Web Hosting | shareasale | $65/sale |
| SEMrush SEO Toolkit | impact | 40% recurring |
| ConvertKit Email Marketing | cj | 30% lifetime |
| Teachable Online Courses | impact | 30% recurring |
| Canva Pro Design | impact | $36-$80/sale |
| NordVPN Privacy | cj | 100% monthly |
| Shopify E-commerce | impact | $150 bounty |
| ClickFunnels 2.0 | clickbank | 30% recurring |
| Amazon Associates | amazon | 4-10% |
| Wealthy Affiliate Training | shareasale | $235/yr recurring |

## Verification Pipeline

- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx vitest run` → 1715/1746 pass (+1 net vs 1714)
- [x] `npx vitest run src/app/api/affiliate-discovery/` → 6/6 pass
- [x] `npm run build` → success
- [x] `wrangler d1 execute --remote 0031` → catalog table created
- [x] `wrangler d1 execute --remote 0032` → 10 rows inserted
- [x] code-reviewer 8.5/10 APPROVE (0 blockers)
- [x] git commit + push (`239fd4ba feat(affiliate): public catalog table with 10 seeded offers`)
- [x] `npm run deploy:build` + `npx wrangler deploy --name sophia-ai-factory`
- [x] `wrangler-set-build-vars.sh` (DEPLOYED_AT + DEPLOY_BRANCH)
- [x] `/api/version` shortSha = local 239fd4ba ✅
- [x] Production smoke: `/api/affiliate-discovery?limit=20` → `total=10 offers=10`
- [x] Production smoke: `/vi/affiliate-discovery` → HTTP 200 (133KB rendered)

## Score Summary

| Item | Result |
|---|---|
| Test count | 1714 → **1715** (+1 net) |
| TS errors | 0 |
| Code review | **8.5/10 APPROVE** (no blockers) |
| Production SHA | 239fd4ba ✅ match |
| Public offers | 10 active rows |

## Bonus: Catalog Schema Allows Multi-Network

Schema CHECK now permits 6 networks: `clickbank | shareasale | amazon | impact | cj | manual`. Old `affiliate_offers_selected` only allowed 4 (no `impact|cj`).

## Open Questions

1. Filter params (`network`, `category`) on public route — indexes ready, easy add
2. Migration 0033: add `UNIQUE(network, url)` + URL scheme CHECK (defensive)
3. `catch {}` in `page.tsx` swallows errors silently — add structured logging
4. Seed re-apply policy — `INSERT OR IGNORE` works for now; may need diff-based later
5. Admin UI to add offers without SQL — deferred (manual seed via migration is fine for MVP)

## Next Steps

1. ~~git commit + push~~ ✅ done (`239fd4ba`)
2. ~~wrangler deploy + verify SHA match~~ ✅ done
3. ~~smoke `/api/affiliate-discovery` returns 10 offers~~ ✅ done
4. (deferred) seed more offers as networks/programs join
5. (deferred) Telegram bot activation when user provides BotFather token
