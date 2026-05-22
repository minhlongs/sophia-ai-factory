# Sophia Solo SOPs Platform — Strategy & Implementation Plan

**Date:** 2026-05-22
**Status:** Research Complete → Ready for Implementation Planning
**Goal:** Transform Sophia from AI Video Factory → Solo Creator SOPs Platform via OpenClaw

---

## Executive Summary

Sophia AI Factory ($199-$4,999/mo AI video SaaS) pivots to **Solo SOPs Platform** — a business-in-a-box ecosystem where creators buy/sell/execute standardized operating procedures for video-based MMO (Make Money Online). This combines Sophia's existing video pipeline with a SOP marketplace + affiliate engine + community layer.

**Why now:** Creator economy = $250B-$313B (2026), 23-30% CAGR. Faceless video = 38% of new ventures. AI video tools market = $716M → $10.6B by 2033. Solo creators need packaged workflows, not just tools.

**Revenue target:** $30K ARR by M6, $1M ARR by Y2.

---

## Research Reports (4 parallel agents)

| # | Report | Key Insight |
|---|--------|------------|
| 1 | [Creator Economy Market](../reports/research-01-creator-economy-market.md) | $250B+ market, faceless video = fastest segment, AI tools = 75% adoption |
| 2 | [Video MMO Monetization](../reports/research-02-video-mmo-monetization.md) | AI avatar agency = 96% margin, VN market = 50M gamers, MoMo/PayOS needed |
| 3 | [Platform Distribution](../reports/research-03-platform-distribution-strategy.md) | Whop+Skool hybrid, 40% affiliate, 85/15 creator split, Y1 ~$465K |
| 4 | [OpenClaw RAAS Architecture](../reports/research-04-openclaw-raas-sop-platform.md) | D1 schema ready, Inngest FSM execution, 4 phases / 8-12 weeks |

---

## Strategic Positioning

```
                    TOOL ONLY          MARKETPLACE ONLY       SOPHIA (BOTH)
                    ─────────          ────────────────       ─────────────
HeyGen/Synthesia    ✅ Video gen       ❌ No marketplace      ✅ Video gen
Whop                ❌ No tool         ✅ Digital products     ✅ SOP marketplace
Skool               ❌ No tool         ✅ Community            ✅ Community + exec
Canva               ✅ Design tool     ✅ Templates            ✅ Templates + revenue
                                                              ✅ Execution engine
                                                              ✅ Affiliate program
                                                              ✅ BYOK (own API keys)
```

**Moat:** Sophia = execution engine + marketplace + community. Competitors have 1 of 3.

---

## Revenue Architecture

### Tier Restructure (from current $199-$4,999)

| Tier | Price | Target | Includes |
|------|-------|--------|----------|
| **FREE** | $0 | Casual explorers | 1 SOP, 3 video runs/mo, browse marketplace |
| **STARTER** | $29/mo | New creators | 5 SOPs, 50 runs/mo, basic templates |
| **CREATOR PRO** | $99/mo | Serious creators | Unlimited SOPs, 500 runs/mo, all templates + community |
| **AGENCY** | $299/mo | Agencies/teams | White-label, team seats, API access, webhooks |
| **MASTER** | $599/mo | SOP creators | Publish SOPs to marketplace, earn 70% commission, affiliate tools |

### Revenue Streams

1. **Subscriptions** — $29-$599/mo recurring (primary)
2. **Marketplace commission** — 30% of each SOP sale ($9-$99 per SOP)
3. **Affiliate program** — 40% recurring for 12mo, then 20% ongoing
4. **BYOK markup** — Users bring API keys, platform charges orchestration fee

### Year 1 Projection (Conservative)

| Source | M3 | M6 | M12 |
|--------|-----|-----|------|
| Subscriptions | $2.5K | $12K | $24K MRR |
| Marketplace | $500 | $3K | $8K MRR |
| Affiliate-driven | $0 | $2K | $6K MRR |
| **Total MRR** | **$3K** | **$17K** | **$38K** |
| **ARR run-rate** | $36K | $204K | **$456K** |

---

## Implementation Phases

### Phase 1: SOP Engine (Weeks 1-2) ✅ CORE DONE
- [x] D1 schema: `sop_templates`, `user_sop_installations`, `sop_executions` (3 tables, 5 indexes)
- [x] TypeScript types: 4 union + 5 row types in `seed/db/types.ts`
- [x] SOP definitions: 5 official SOPs with bilingual metadata in `seed/config/sops/`
- [x] DB repository: 13 CRUD functions in `seed/db/repositories/sop-repo.ts`
- [x] Inngest FSM execution engine: `forest/sops/sop-executor.ts` (353 lines)
- [x] Build: tsc clean, `npm run build` passes
- [ ] SOP viewer UI (step-by-step progress tracker) — Phase 2
- [ ] Apply migration to remote D1 — at deploy time
- **Files:** `seed/db/migrations/`, `seed/config/sops/`, `seed/db/repositories/`, `forest/sops/`

### Phase 2: SOP Library + Tier Gating (Weeks 3-4) ✅ DONE
- [x] **Discovery:** Existing SOP system already has 31 playbooks, full UI, executor, marketplace
- [x] 5 new MMO/creator economy playbooks added (31→36 total): faceless-youtube, tiktok-creativity, youtube-shorts, ugc-agency, ai-avatar-agency
- [x] `sopInstallLimit` added to tier config (BASIC:5, PREMIUM:15, ENT/MASTER:999)
- [x] Tier gating UI: lock icon + "Upgrade" CTA on SOP card when at limit
- [x] Marketplace page fetches user tier + install count, passes to grid
- [x] i18n keys added (en + vi)
- [x] Build passes, tsc clean
- **Files:** `lib/sop/seeds/playbooks/`, `seed/config/tiers/`, `forest/components/sop/`, `messages/`

### Phase 3: Marketplace + Creator Mode (Weeks 5-7) ✅ DONE
- [x] D1 schema: `sop_listings`, `sop_licenses` (2 tables, 4 indexes)
- [x] Creator SOP editor (MASTER tier only) — `/dashboard/sop-creator/new`
- [x] Marketplace browse with community SOPs + purchase flow
- [x] MVP purchase flow (real NOWPayments integration deferred to Phase 4)
- [x] 70/30 creator/platform commission split via existing commission_ledger
- [x] Creator dashboard (earnings summary, sales table) — `/dashboard/sop-creator`
- [x] Marketplace repo: 13 new CRUD functions in `sop-repo-marketplace.ts`
- [x] i18n: `sop.creator` + `sop.community` keys (en + vi)
- [x] Build passes, tsc clean
- [ ] PayOS integration for VN domestic — Phase 4+
- **Files:** `lib/sop/sop-repo-marketplace.ts`, `land/sop-marketplace/`, `app/[locale]/dashboard/sop-creator/`, `app/[locale]/dashboard/sop-marketplace/`

### Phase 4: Affiliate + Growth Engine (Weeks 8-10) ✅ DONE
- [x] SOP affiliate link generation (reuses existing affiliate_links table with `offer_id=sop_{templateId}`)
- [x] Share UI: ShareButtons (copy, X, FB, LinkedIn, Telegram) + ShareResultsCard
- [x] User-facing leaderboard: top creators by SOP sales + top affiliates by commission
- [x] Monthly challenges: D1 schema + CRUD + 3 seed challenges + progress page
- [x] Referral landing page `/ref/[code]` with OG metadata, click tracking, ref cookie
- [x] i18n: `leaderboard` + `challenges` keys (en + vi)
- [x] Build passes, tsc clean
- **Files:** `land/sop-marketplace/sop-affiliate-links.ts`, `forest/components/share/`, `app/[locale]/dashboard/leaderboard/`, `app/[locale]/dashboard/challenges/`, `app/ref/[code]/`

### Phase 5: Distribution & Go-to-Market (Weeks 10-12)
- [ ] ProductHunt launch preparation
- [ ] YouTube channel: 4 tutorial videos (faceless channel SOP, UGC agency SOP, etc.)
- [ ] TikTok: "SOP of the day" content format
- [ ] Reddit: r/entrepreneur, r/YouTubers, r/SaaS posts
- [ ] Recruit 10-20 beta creators (50% rev share first 2 months)
- [ ] Telegram community setup (Vietnamese market)

---

## Vietnamese Market Strategy

| Challenge | Solution |
|-----------|----------|
| Polar.sh = no VND payout | PayOS + MoMo for domestic |
| International payments | NOWPayments (USDT crypto) |
| Language barrier | Bilingual SOPs (vi + en), next-intl already in place |
| Trust building | Facebook groups + Telegram + local influencers |
| Price sensitivity | Lower VN pricing ($9-$49/mo vs global $29-$599) |

---

## SOP Catalog (Initial 10)

| # | SOP Name | Category | Difficulty | Est. Revenue |
|---|----------|----------|-----------|-------------|
| 1 | Faceless YouTube Cash Cow | Content | Beginner | $2K-$10K/mo |
| 2 | TikTok Creativity Program | Content | Beginner | $1K-$5K/mo |
| 3 | YouTube Shorts Monetization | Content | Beginner | $500-$3K/mo |
| 4 | UGC Creator Agency | Business | Intermediate | $5K-$20K/mo |
| 5 | AI Avatar Video Agency | Business | Intermediate | $10K-$50K/mo |
| 6 | White-Label Video Production | Business | Advanced | $20K-$100K/mo |
| 7 | Affiliate Video Marketing | Marketing | Beginner | $1K-$5K/mo |
| 8 | AI Voiceover Service | Business | Beginner | $2K-$8K/mo |
| 9 | Educational Course Creator | Content | Intermediate | $5K-$30K/mo |
| 10 | Multi-Platform Repurposing | Operations | Beginner | $1K-$3K/mo |

---

## Growth Flywheel

```
FREE users (1,000)
  ↓ install free SOP, try 3 runs
PAID (4% convert → 40 users × $99)
  ↓ buy marketplace SOPs
MARKETPLACE buyers (spend $29-99/SOP)
  ↓ 5-10% become creators
MASTER creators ($599/mo, publish SOPs)
  ↓ earn 70% + recruit affiliates
AFFILIATES (40% recurring commission)
  ↓ drive new FREE users
→ LOOP
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Low creator adoption | HIGH | Beta invitations + consulting + 50% rev share M1-M2 |
| SOP quality variance | MEDIUM | Review queue + ratings + refund policy (14 days) |
| Payment friction (VN) | MEDIUM | Multi-provider: NOWPayments + PayOS + MoMo |
| Execution timeouts (CF Workers) | MEDIUM | Inngest async + circuit breaker |
| Competitor copies model | LOW | Network effects + first-mover + BYOK moat |

---

## Unresolved Questions

1. Creator approval: manual review vs automated scoring?
2. Affiliate payout frequency: weekly vs monthly?
3. Refund window: 14 vs 30 days?
4. Marketplace discovery algo: popularity vs conversion rate vs recency?
5. VN-specific pricing tier: separate or percentage discount?
6. Should MASTER tier include white-label (currently in AGENCY)?
7. Telegram bot integration: SOP execution via bot commands?

---

## Next Steps

1. **USER DECISION**: Approve strategy + resolve unresolved questions
2. **Phase 1 detailed planning**: `/cook Phase 1: SOP Engine` from `apps/sophia-ai-factory/`
3. **Creator recruitment**: Identify 10 beta creators for launch SOPs
4. **Content calendar**: YouTube + TikTok + Reddit posting schedule
