# Sophia AI Factory — Brainstorm Report

## Session: 2026-07-14
Full 4-dimension brainstorm for next strategic decisions. Input from parallel research agents + codebase scout.

---

## EXECUTIVE SUMMARY

5 strategic pillars chính từ brainstorm:

1. **Revenue Velocity** — Multi-pricing-axis + viral growth loops
2. **Product-Market Fit Deepening** — Vietnam-local-first features
3. **Platform Flywheel** — Self-service automation + community
4. **Technical Foundation** — Reliability + cost + speed
5. **Competitive Moats** — Sequences others can't copy cheaply

---

## PILLAR 1: REVENUE VELOCITY

### 1.1 Usage-Based Micro-Pricing (NEW STRIPE)
**Effort**: S | **Revenue Impact**: High | **Priority**: P1

CURRENT PROBLEM: Subscription-only model means:
- Small users overpay, big users underpay
- Casual/one-off users blocked by subscription gating
- No upgrade path cho users who ran 5 videos/month on BASIC tier

PROPOSED: Hybrid pricing model:
```
Subscription (current) + Pay-per-video add-on credits
- 1 credit = 1 AI video generation (OpenRouter call + D-ID avatar)
- Credits expire in 90 days
- Packs: 10 credits ($29), 50 credits ($99), 200 credits ($299)
- Credits stack with subscription quota
```

WHY IT WORKS:
- Lowers trial/activation friction (no subscription commitment)
- Upsell triggers trong-app after user hits usage limits
- Lifetime value increases via credit refills (proven in Vercel, RunwayML)
- Vietnam-friendly: many small businesses prefer pay-as-they-go

REVENUE MATH (estimated):
- 30% of users buying 1 credit pack/quarter on top of sub → +35% ARPU
- 15% one-off users converting to paid via credits → +20% new customer rate

### 1.2 Agency/White-Label Tier
**Effort**: M | **Revenue Impact**: Very High | **Priority**: P2

PROPOSED: Reseller tier cho agency clients who run campaigns for multiple customers:
- Agency admin dashboard with multi-client management
- Custom branding (logo, color scheme per client)
- Usage reporting & pass-through pricing
- API access per sub-client
- Volume discounts (20-40% off retail pricing)

VIETNAM CONTEXT: Digital marketing agencies exploded in Vietnam (2023-2025 wave). They're building AI video capabilities in-house AND looking to outsource. White-label lets them brand as their own solution.

REVENUE MATH:
- Agency seat: $299-499/month (vs $49-199 individual)
- Each agency manages 5-20 end-clients → platform effect multiplier
- Acquisition: Partner with agencies → white-label is a no-brainer upsell

### 1.3 Template Marketplace
**Effort**: M-L | **Revenue Impact**: Medium | **Priority**: P3

PROPOSED:
- Curated library of production-ready campaign templates (storyboard + script + AI prompts)
- Categories: E-commerce product launch, real estate listings, education promos, food & beverage, HR recruitment...
- Free tier: 3 templates
- Premium: Unlimited + community submissions
- Revenue share cho contributor templates (30% to platform, 70% to creator)

STICKINESS EFFECT: Templates reduce time-to-first-video from hours → minutes. Critical for onboarding.

---

## PILLAR 2: PRODUCT-MARKET FIT (VIETNAM-FIRST)

### 2.1 Vietnamese Video Format Optimization
**Effort**: S | **Retention Impact**: High | **Priority**: P1

CURRENT GAP: All AI video generation is probably optimized for English/phonetic tones. Vietnamese has tonal language + unique phonetics.

PROPOSED:
- Vietnamese-optimized voice presets trong ElevenLabs integration
- "Vietnamese Natural" voice model selection
- Script validation: flag difficult Vietnamese phonetic combinations
- Subtitle styling optimized cho Vietnamese text (font adjustments for diacritics)

### 2.2 Multi-Channel Auto-Adapt
**Effort**: M | **Retention Impact**: High | **Priority**: P2

CURRENT STATE: Platform generates video. User manually uploads to each platform.

PROPOSED:
- One video → auto-format cho: Telegram (vertical 9:16), Facebook (square 1:1 + vertical), TikTok (9:16), Instagram Reels, YouTube Shorts
- One-click publish to FB/Instagram APIs for MASTER tier
- Caption/hashtag generation per platform (AI writes FB caption, TikTok hook, etc.)
- Thumbnail extraction + optimization per platform specs

VIETNAM CONTEXT: Vietnamese marketers post same content to Zalo OA + Facebook + TikTok + Shopee Live Auto-cut is huge time-saver.

### 2.3 Zalo (Zalo OA) Integration
**Effort**: M-L | **Retention Impact**: Medium | **Priority**: P2

Zalo is THE dominant messaging app in Vietnam (92M users). Zalo Official Account (Zalo OA) là equivalent của Facebook Pages.

PROPOSED:
- Zalo OA webhook integration (mirror Telegram bot architecture)
- Broadcast campaign videos to Zalo OA followers
- Zalo-specific rich media formatting
- Vietnam-only feature — competitive moat

---

## PILLAR 3: PLATFORM FLYWHEEL

### 3.1 Smart Campaign Sequencer
**Effort**: M | **Retention Impact**: High | **Priority**: P2

CURRENT STATE: User generates video, posts manually. No automation loop.

PROPOSED:
- Campaign builder: define sequence (video A on day 1, video B on day 3, follow-up C on day 7)
- Each step triggers next based on previous performance (if A > 100 views → post B)
- Smart scheduling based on optimal posting times (learned from user's own analytics)
- "Set it and forget it" — builds stickiness through dependency

### 3.2 Batch Video Generation
**Effort**: M | **Retention Impact**: Medium | **Priority**: P3

PROPOSED:
- Upload CSV: product_name, price, offer, image_url → generate N personalized videos
- Each video has unique product info + same visual template
- Use case: E-commerce stores with 50+ products
- Progress indicator + batch download (ZIP via R2)

EFFICIENCY WIN: Customer-facing feature that replaces what would take agencies 2-3 weeks per product line into a single afternoon.

### 3.3 Community Showcase
**Effort**: S | **Retention Impact**: Medium | **Priority**: P3

PROPOSED:
- Public gallery of generated campaigns (opt-in)
- Users can like/comment/remix
- "Made with Sophia" badges → social proof drives organic acquisition
- Low effort because videothumbnails are already stored on R2

---

## PILLAR 4: OPERATIONAL EFFICIENCY

### 4.1 AI-Powered Support Triage
**Effort**: S | **Time Savings**: High | **Priority**: P1

CURRENT STATE: Support likely manual/threshold-based.

PROPOSED:
- Telegram bot auto-resolves common queries (API key issues, quota questions, billing confusion)
- Escalation to human operator only for: payment disputes, tier upgrade requests, bug reports
- Estimated: 60-70% support volume self-resolvable by bot

### 4.2 Cost Attribution Dashboard
**Effort**: M | **Time Savings**: Medium | **Priority**: P2

CURRENT STATE: AI API costs (OpenRouter, ElevenLabs, D-ID) probably aggregated or not tracked per-customer.

PROPOSED:
- Track per-video cost: OpenRouter token usage + D-ID generation time + ElevenLabs TTS seconds
- Map to customer account → show "cost to serve" vs "revenue from"
- Alert khi customer cost exceeds 80% of their subscription value (profitability warning)
- Data feeds INTO future pricing decisions

### 4.3 Automated Quality Gate
**Effort**: M | **Risk Reduction**: High | **Priority**: P2

PROPOSED:
- Post-generation quality check:
  - Video metadata sanity (duration, resolution, file size)
  - D-ID avatar: detect failure modes (glitch frames, silent output)
  - OpenRouter: prompt injection detection in user scripts
  - Cost cap per customer per day (kill runaway generation)
- Failed videos auto-retry (max 3 attempts with different params)
- Customer notified of degraded output, not just silent failure

### 4.4 Inngest Workflow Visibility
**Effort**: S | **Time Savings**: Medium | **Priority**: P3

PROPOSED:
- Customer-facing "campaign status" view trong app UI (currently Telegram-only?)
- Inngest webhook → D1 status table → live progress in dashboard
- Estimated progress for long-running jobs (video generation often takes 30s-5min)
- Email/Telegram push khi video ready

---

## PILLAR 5: TECHNICAL FOUNDATION

### 5.1 API Resilience Layer
**Effort**: M | **Reliability Impact**: High | **Priority**: P1

CURRENT EXTERNAL DEPS: OpenRouter, ElevenLabs, D-ID, Telegram, NOWPayments. Each là a potential failure point.

PROPOSED:
- Circuit breaker pattern: sau N failures trong W seconds → degrade gracefully
- OpenRouter/D-ID/ElevenLabs: fallback providers (replicate.com, PlayHT, HeyGen)
- Retry with exponential backoff + jitter
- Graceful degradation: if avatar video fails → deliver audio-only version cho BASIC tier
- User-facing status: "Avatar generation paused — will resume automatically" vs "Error"

### 5.2 CF Workers Optimization
**Effort**: M | **Cost Savings**: 30-40% | **Priority**: P2

PROPOSED:
- Cache static assets (video thumbnails, templates) trong R2 + KV edge cache
- Edge middleware cho auth (Better Auth session validation at edge, not in handler)
- D1 query optimization: indexes trên user_id, campaign_id, created_at
- Bundle analysis: identify & eliminate dead code
- Next.js 16: cacheComponents = 'force-static' cho campaign listing pages

### 5.3 Type Safety Hardening
**Effort**: S-M | **DX Impact**: Medium | **Priority**: P2

PROPOSED:
- Eliminate all `:any` types in production code (0 tolerance per CLAUDE.md)
- Zod schema consolidation: một source of truth cho shared types
- Generate D1 schema types từ migration files (typed D1)
- Add `@types/` coverage for external dependencies missing types

---

## IMPACT × EFFORT MATRIX

| Priority | Idea | Effort | Impact | Category |
|----------|------|--------|--------|----------|
| P1 ⬆ | Usage-Based Micro-Pricing | S | H | Revenue |
| P1 ⬆ | Vietnamese Voice Optimization | S | H | PMF |
| P1 ⬆ | AI Support Triage | S | H | Ops |
| P1 ⬆ | API Resilience Layer | M | H | Tech |
| P2 → | Agency/White-Label Tier | M | VH | Revenue |
| P2 → | Multi-Channel Auto-Adapt | M | H | PMF |
| P2 → | Zalo OA Integration | M-L | M | PMF |
| P2 → | Smart Campaign Sequencer | M | H | Flywheel |
| P2 → | Cost Attribution Dashboard | M | M | Ops |
| P2 → | Automated Quality Gate | M | H | Ops |
| P2 → | CF Workers Optimization | M | M | Tech |
| P3 | Template Marketplace | M-L | M | Revenue |
| P2 → | Type Safety Hardening | S-M | M | Tech |
| P3 | Batch Video Generation | M | M | Flywheel |
| P3 | Community Showcase | S | M | Flywheel |
| P3 | Inngest Workflow Visibility | S | M | Ops |

---

## SUGGESTED EXECUTION ORDER (next 30 days)

### Sprint 1 (Week 1-2): P1 Foundation
1. Usage-Based Micro-Pricing (S effort, H impact — immediate revenue uplift)
2. Vietnamese Voice Optimization (S effort — competitive moat)
3. AI Support Triage (S effort — ops relief)
4. API Resilience Layer foundation (M effort — reliability)

### Sprint 2 (Week 3-4): P2 Momentum
5. Agency/White-Label Tier (design contracts, pilot với 2-3 agencies)
6. Multi-Channel Auto-Adapt (format conversion logic)
7. Smart Campaign Sequencer (core automation)
8. Cost Attribution Dashboard (data pipeline)

### Sprint 3+ (Month 2-3): P3 + Expansion
9. Zalo OA Integration
10. CF Workers Optimization
11. Type Safety Hardening (continuous)
12. Template Marketplace (beta)

---

## OPEN QUESTIONS / DECISIONS NEEDED

1. **Pay-per-video vs pure subscription**: Hybrid hay migrate sang usage-based primary?
2. **Agency tier pricing**: $299 vs $499 sweet spot? 1 agency = unlimited clients or per-seat?
3. **Vietnam voice**: ElevenLabs custom voice cloning cho Vietnamese speakers — ROI?
4. **Zalo integration**: Build native Zalo OA bot hay wait cho Zalo API maturity?
5. **Template marketplace**: Self-serve submissions hay curated-only? Quality vs volume?
6. **Fallback provider strategy**: Replicate.com (cost) vs HeyGen (pareto) vs in-house?

---

## SUCCESS METRICS TO TRACK

Revenue:
- MRR growth rate
- ARPU per tier
- Credit pack attach rate

Retention:
- 30-day retention rate per cohort
- Time-to-second-video (days from signup to 2nd generation)
- DAU/MAU ratio

Operations:
- Support ticket volume / active user
- Avg generation time per video
- Cost per video generated (OpenRouter + D-ID + ElevenLables)
- Profit margin per customer tier

Technical:
- P95 API response time
- Circuit breaker trip frequency
- npm run build: 0 errors
- npm test: 844+ passing

---

## DEPENDENCIES

Revenue: Payment flow must support split/coupon logic → may need update NOWPayments IPN handler Ops: AI support triage → depends on Telegram bot architecture Tech: CF optimization → depends on current bundle analysis (needs scout output)

---

## rec_length_for_full_report: medium
## key_citation_files:
- apps/sophia-ai-factory/CLAUDE.md
- apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md
- apps/sophia-ai-factory/src/seed/config/tiers.ts
- apps/sophia-ai-factory/migrations/
