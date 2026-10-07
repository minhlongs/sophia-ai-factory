# Tech Stack Architecture — SaaS & Crypto Global Video Production & Affiliate Engine

**Date:** 2026-10-07  
**Scope:** Autonomous Video Generation, Script/Storyboard Engine, Global Compliance & Multi-Network Affiliate Attribution  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router (Node.js runtime for FFmpeg/Remotion workers)  

---

## 1. Core Technology Selection

| Domain | Technology | Justification & Architectural Role |
|---|---|---|
| **Edge Compute** | Cloudflare Workers (`@opennextjs/cloudflare`) | Lightweight API edge gateway, geo-fencing, and sub-15ms request routing. |
| **Relational Data** | Cloudflare D1 (SQLite) | Persistent store for video campaign metadata, attribution logs, and quota accounting. |
| **Background Orchestration** | Inngest SDK v3.x | Durable multi-step pipeline for LLM script synthesis, audio generation, and video composition. |
| **AI Script Generation** | OpenRouter LLM (Claude 3.5 Sonnet / GPT-4o) | High-converting hook, agitation, and CTA generation calibrated by niche blueprints. |
| **Video Assembly** | Remotion / FFmpeg Node.js Worker | Dynamic canvas rendering: Kinetic typography, Obsidian/SaaS Dark UI mockups, 15s end-card. |
| **Affiliate Attribution** | Custom Multi-Network SubID Builder | Deterministic query-param injection for PartnerStack, Impact, Rewardful, Binance, Bybit. |
| **Compliance Guard** | GeoIP & Static Disclaimer Registry | FTC 16 CFR §255, CFTC 4.41, EU MiCA Art. 7/53, SG MAS PSN08, VN Decree 52/2024 hard geo-block. |
| **Validation** | Zod v3.24+ | Fail-closed runtime validation for script blueprints, affiliate codes, and job payloads. |

---

## 2. Layered Component Architecture (Sophia 4-Layer)

```
seed (Foundational primitives & schemas)
  ├── src/seed/config/video-blueprints/
  │   ├── blueprint-types.ts                  — Niche enums, Blueprint models, Storyboard contracts
  │   ├── saas-global-blueprints.ts           — SOP/Fix, Tool Battle, Fast Listicle config
  │   ├── crypto-global-blueprints.ts         — Fee Discount, Bot Blueprint, Staking/Launchpool config
  │   └── index.ts                            — Unified Blueprint Registry
  ├── src/seed/config/crypto-disclaimer-registry.ts — Global regulatory texts & jurisdiction rules

tree (Domain builders, prompt synthesis & compliance logic)
  ├── src/tree/video/prompts/
  │   ├── saas-script-prompt-builder.ts       — Prompt engineering for SaaS workflows & tool battles
  │   ├── crypto-script-prompt-builder.ts     — Prompt engineering for high-LTV crypto volume traders
  │   └── storyboard-generator.ts             — Deterministic scene breakdown & timing calculator
  └── src/tree/video/compliance/
      └── jurisdiction-compliance-guard.ts    — GeoIP inspector & disclaimer requirement engine

forest (Infrastructure orchestration & background jobs)
  ├── src/forest/inngest/functions/
  │   └── niche-video-dispatcher.ts           — Inngest background job consuming single-click requests
  └── src/forest/actions/
      └── niche-video-actions.ts              — Safe 'use server' actions with Better-Auth validation

land (Domain workflows, video assembly & affiliate integration)
  ├── src/land/affiliates/
  │   └── video-description-injector.ts       — Enhanced multi-network tracking link & FTC injector
  └── src/land/video/blueprints/
      ├── niche-video-generator-service.ts    — Core business orchestrator coordinating tree & forest
      └── crypto-compliance-overlay.ts        — 15s end-card & persistent caption overlay composer
```

---

## 3. Operational & Compliance Guarantees

1. **Strict File Size Bound**: Every new and modified file strictly $\le 200$ LOC.
2. **Deterministic Layer Boundaries**:
   - `seed` has zero imports from upper layers.
   - `tree` imports only `seed`.
   - `forest` orchestrates `seed`, `tree`, and triggers `land`.
   - `land` implements business workflows, consuming `seed` and `tree`.
3. **No-Code / BYOK Model**: Customer provides their OpenRouter / ElevenLabs / HeyGen keys. Zero operator credentials needed.
4. **Hard Geo-Fencing for Crypto**: All crypto video campaign landing routes enforce Cloudflare `CF-IPCountry` checks. Traffic from Vietnam (`VN`) or Singapore (`SG`) is blocked from speculative derivative funnels in compliance with SBV Decree 52/2024/NĐ-CP & MAS Notice PSN08.
5. **Mandatory 15s Legal End-Card**: Crypto blueprint video pipelines strictly enforce a non-skippable 15-second compliance card with dipped audio bed (-18dB) and high-contrast WCAG AA text.
