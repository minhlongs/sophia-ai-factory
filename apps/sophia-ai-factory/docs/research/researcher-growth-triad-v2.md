# Research & Validation: Growth Triad v2 (Voice Cart Recovery, Ad Arbitrage MAB, Parasite SEO)

## Executive Summary
This document outlines the technical feasibility, architectural design, regulatory compliance, and execution strategy for the Growth Triad v2 Expansion Suite:
1. **AI Voice Agent Abandoned Cart Recovery Closer**: Real-time automated voice dialer with objection handling, DNC time-window guards, and instant SMS voucher dispatch.
2. **Paid Ads Arbitrage Commander**: Multi-Armed Bandit (MAB) Thompson Sampling budget optimizer & CPA stop-loss protection across TikTok/Meta advertising.
3. **Parasite SEO Automated Syndication Engine**: Long-form review generator with Schema.org JSON-LD and cloaked affiliate bridges syndicated to high-authority platforms.

## Pillar 1: AI Voice Agent Abandoned Cart Recovery
- **Problem**: 70-80% cart abandonment on e-commerce funnels. Traditional SMS/Email conversion rate is < 8%.
- **Solution**: Ultra-fast (<120s from abandonment) automated voice outreach using low-latency conversational AI pipelines.
- **Compliance & Safety**:
  - Enforce strict TCPA / local DNC (Do-Not-Call) hours: Only call between 09:00 and 20:00 in customer's local timezone.
  - Frequency cap: Maximum 1 outbound call per cart session.
  - Fallback to instant discount SMS if user does not answer within 4 rings.
- **Objection Matrix**:
  - `PRICE_HIGH`: Offer 10-15% dynamic one-time discount code valid for 1 hour.
  - `SHIPPING_COST`: Offer free express shipping waiver.
  - `TRUST_ISSUE`: Highlight 30-day money-back guarantee and social proof ratings.

## Pillar 2: Paid Ads Arbitrage Commander
- **Problem**: Affiliates lose profitability when campaign CPA rises above EPC (Earnings Per Click) or hook fatigue occurs.
- **Solution**: Algorithmic Thompson Sampling Multi-Armed Bandit (MAB) budget rebalancer:
  - If 24h rolling CPA > EPC * 0.9 (breakeven boundary), immediately trigger emergency stop-loss/pause.
  - If 24h rolling ROAS > 2.5x, scale budget by +20% automatically every 12h.
  - Exploitation vs Exploration ratio: 80% winning creatives, 20% exploration for fresh ad hooks.

## Pillar 3: Parasite SEO Automated Syndication Engine
- **Problem**: Short-form videos have ephemeral viral life cycles (24-48 hours), missing long-tail organic search volume.
- **Solution**: Transform breakout SKU intelligence into structured long-form comparison articles (Product Review, Top 5 Alternatives, Buying Guide):
  - Injects Schema.org `Product` & `Review` JSON-LD metadata for Google Rich Results.
  - Programmatic bridge link cloaking (`/go/[slug]`) with affiliate UTM tracking.
  - Target platforms: Medium, Substack, LinkedIn Pulse, Ghost.

## Architecture Boundaries (Clean Architecture)
- `seed`: Types, Zod validation schemas, Inngest event definitions.
- `tree`: Pure deterministic calculators (objection state machine, Thompson sampling budget allocator, Schema.org generator).
- `forest`: Inngest background jobs (`voice.cart.recovery.triggered`, `ads.arbitrage.optimized`, `seo.parasite.syndicated`).
- `land`: Authenticated Server Actions (`callRecoveryAction`, `optimizeAdBudgetAction`, `syndicateArticleAction`).
- `presentation`: Responsive UI Cockpits with bilingual support.
