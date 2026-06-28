---
title: "MekongMind MVP Launch — First Sale"
description: "Wire Polar products, landing page, checkout flow, post-purchase provisioning to get first paying customer"
status: mostly-complete
priority: P1
effort: 5h
branch: feat/antigravity-community
tags: [mekonmind, polar, revenue, mvp, launch]
created: 2026-04-09
completed: 2026-04-09
---

# MekongMind MVP Launch Plan

**Goal:** XONG = $ vao tai khoan. Ship minimum viable commercial product.
**Work context:** `~/mekong-cli` on M1 Max (branch `feat/antigravity-community`)
**Deploy:** Landing on CF Pages, Backend on M1 Max (uvicorn + Cloudflare Tunnel)

## CRITICAL: Pricing Discrepancy

Two conflicting pricing definitions exist:
- `src/raas/pricing.py`: FREE=$0/50cr, Starter=$29/500cr, Pro=$99/2500cr, Team=$249/10Kcr
- `src/raas/revenue_router.py`: Starter=$49/200cr, Growth=$149/1000cr, Pro=$499/5000cr

**Decision needed:** Align on ONE pricing. Plan uses `revenue_router.py` tiers (higher margins, simpler):
| Tier | Price | Credits | Polar Product |
|------|-------|---------|---------------|
| Starter | $49/mo | 200 MCU | mekonmind-starter |
| Growth | $149/mo | 1,000 MCU | mekonmind-growth |
| Pro | $499/mo | 5,000 MCU | mekonmind-pro |

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | [Polar Products](phase-01-polar-products.md) | BLOCKED | 15min | Script ready, needs POLAR_ACCESS_TOKEN from user |
| 2 | [Landing Page](phase-02-landing-page.md) | DONE | 2h | Deployed to mekonmind.pages.dev |
| 3 | [Checkout Flow](phase-03-checkout-flow.md) | DONE | 1h | POST /v1/checkout + GET /v1/success wired, security hardened |
| 4 | [Post-Purchase](phase-04-post-purchase-flow.md) | DONE | 1h | Webhook verified 21/21, HMAC sig required for provisioning |
| 5 | [Deploy + Smoke Test](phase-05-deploy-smoke-test.md) | MOSTLY DONE | 30min | Gateway imports OK, landing deployed, E2E mission test PASS |

## Dependencies

```
Phase 1 (Polar Products) ──> Phase 3 (needs product_ids for checkout URLs)
Phase 2 (Landing)        ──> Phase 3 (landing links to checkout)
Phase 3 (Checkout)       ──> Phase 4 (success page shows API key)
Phase 1-4                ──> Phase 5 (E2E test)
```

## Env Vars Required (M1 Max `~/.mekong/.env`)

```
POLAR_ACCESS_TOKEN=pol_...       # For SDK product creation
POLAR_WEBHOOK_SECRET=whsec_...   # Already used in polar_webhook_handler.py
POLAR_ORG_ID=...                 # Polar org slug: longtho638-jpg
```

## Unresolved Questions

1. Domain: `mekonmind.com` or `mekonmind.agencyos.network`? (CF Pages subdomain is free)
2. Align pricing.py with revenue_router.py or keep separate? (revenue_router is source of truth for webhooks)
3. Cloudflare Tunnel already configured for M1 Max gateway, or need setup?
