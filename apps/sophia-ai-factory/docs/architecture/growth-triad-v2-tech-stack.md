# Tech Stack Architecture: Growth Triad v2 (Voice Closer, Ad Arbitrage, Parasite SEO)

## 1. Clean Architecture Mapping

```
apps/sophia-ai-factory/src/
├── seed/
│   └── types/
│       └── growth-triad-v2-types.ts      <- Interfaces, Enums & Zod Schemas
├── tree/
│   ├── voice/
│   │   └── cart-recovery-fsm.ts         <- Pure Objection Handling & DNC Guard
│   ├── ads/
│   │   └── ad-arbitrage-mab.ts          <- Thompson Sampling & CPA Stop-Loss
│   └── seo/
│       └── parasite-article-builder.ts  <- Schema.org JSON-LD & SEO Compiler
├── forest/
│   └── inngest/
│       └── functions/
│           ├── voice-cart-recovery-job.ts
│           ├── ad-arbitrage-optimizer-job.ts
│           └── parasite-seo-publisher-job.ts
├── land/
│   └── growth/
│       ├── actions/
│       │   └── growth-triad-actions.ts  <- Authenticated Server Actions
│       └── index.ts
└── components/
    └── growth-triad-v2/
        ├── voice-recovery-cockpit.tsx
        ├── ad-arbitrage-cockpit.tsx
        ├── parasite-seo-cockpit.tsx
        └── index.ts
```

## 2. Data Models (D1 SQLite Migration 0459)
- `abandoned_cart_voice_calls`: Tracks caller session, phone, objection raised, voucher given, and call outcome.
- `ad_arbitrage_campaigns`: Tracks ad account, platform (TikTok/Meta), spend, GMV, CPA, ROAS, and MAB budget allocation.
- `parasite_seo_articles`: Tracks SKU, platform target (Medium, Substack, etc.), canonical slug, SEO score, and publication status.

## 3. Inngest Event Merged Schema
- `voice.cart.recovery.triggered`
- `ads.arbitrage.optimized`
- `seo.parasite.syndicated`
*(Expands registered event schema from 65 to 68 keys, validated with compile-time bidirectional type assertions).*
