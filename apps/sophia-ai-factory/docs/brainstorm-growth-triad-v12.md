# Brainstorm Contract: Growth Triad v12 & Autonomous Monetization Flywheel

**Date:** 2026-10-08  
**Scope:** Closed-Loop Performance Re-seeding, Resilient Multi-Platform Telemetry & Affiliate Conversion Settlement  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router + Inngest SDK v3.x + Cloudflare D1  

---

## 1. Problem Statement & Assumption Challenge

- **The Assumption:** Video generation and social publishing are separate concerns; users manually review analytics and manually re-enter prompt templates to scale winning campaigns.
- **The Challenge:** In an AI SaaS serving non-technical CEOs running Revenue-as-a-Service (RaaS) empires, manual iteration is the primary growth bottleneck. Furthermore:
  1. Synthetic/mock telemetry (`Math.random()`) in analytics collection blinds the system to real audience retention signals.
  2. Expiring OAuth tokens (TikTok 24h/14d) break publishing silently without proactive rotation.
  3. Video views without closed-loop affiliate revenue attribution lead to wasted compute credits on vanity metrics rather than cashflow.

---

## 2. Synthesized Tri-Pillar Architecture

```
                                  ┌────────────────────────┐
                                  │  Video Synthesis Loop  │
                                  │  (autonomous pipeline) │
                                  └───────────┬────────────┘
                                              │ 
                                              ▼
                                  ┌────────────────────────┐
                                  │ Social Direct Publish  │
                                  │  (YouTube/TikTok/IG)   │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          ┌───────────────────────┐                       ┌───────────────────────┐
          │  Live Metrics Engine  │                       │ Conversion Webhook    │
          │  (Z-Score & Reseed)   │                       │ (ClickBank/PayOS/NOW) │
          └───────────┬───────────┘                       └───────────┬───────────┘
                      │                                               │
                      ▼                                               ▼
          ┌───────────────────────┐                       ┌───────────────────────┐
          │ Darwinian Hook Seed   │                       │ Revenue Attribution   │
          │ (3 Mutated Variants)  │                       │ & One-Click Payout    │
          └───────────────────────┘                       └───────────────────────┘
```

### Pillar 1: Darwinian Performance Reseeding (Growth Triad v12)
- **Retention Z-Score Classifier:** $Z_{\text{ret}} = \frac{\text{retention} - \mu_{\text{channel}}}{\sigma_{\text{channel}}}$. Classifies videos as `ALPHA_VIRAL` ($Z \ge +1.5$), `STEADY` ($-0.5 \le Z < +1.5$), or `STAGNANT` ($Z < -0.5$).
- **Darwinian Auto-Mutator:** When `ALPHA_VIRAL` is reached at T+24h, automatically extracts the winning script hook, generates 3 mutated variants ($D_{\text{JS}} \ge 0.15$), and queues new synthesis via Inngest `video.synthesis.reseed`.
- **Anti-Cannibalization Pacing:** Hard limit of max 2 auto-reseeded videos per channel/day to protect channel algorithmic health.

### Pillar 2: Resilient Social Publisher & OAuth Auto-Rotation
- **Zero-Mock Telemetry Adapters:** Replaces random math in `social-analytics-collector.ts` with typed platform adapters (YouTube Data API v3, TikTok Commercial Content API, Meta Graph API v19.0).
- **Proactive Token Refresh State Machine:** Cron/worker refreshes OAuth tokens 2 hours before expiration in `platform-credentials-store.ts`.
- **Durable DLQ & Circuit Protection:** Exponential backoff retry with automatic tenant circuit tripping on auth failure.

### Pillar 3: Affiliate Conversion Attribution & Instant Payouts
- **HMAC Webhook Ingress:** Normalizes purchase webhooks from ClickBank, PayOS, and NOWPayments.
- **Atomic Attribution Ledger:** Ties conversion revenue directly to `video_manifest_id` and UTM tags via SQLite OCC.
- **CEO 1-Click Payout Manifest:** Generates VietQR (domestic VN) and USDT (crypto) settlement summaries.

---

## 3. 5-Layer Clean Architecture Mapping

| Layer | Component | Responsibility |
|---|---|---|
| **seed** | `growth-v12-types.ts`, `0469_growth_v12_flywheel.sql` | Zod schemas for ReseedTrigger, TokenRefresh, ConversionPayload, D1 schema |
| **tree** | `zscore-classifier.ts`, `hook-darwinian-mutator.ts` | Pure zero-IO math: Z-score evaluation, token JS-divergence mutation |
| **forest** | `growth-v12-reseed-worker.ts`, `token-refresh-cron.ts` | Inngest background jobs: reseed dispatcher, token rotator, webhook queue |
| **land** | `flywheel-coordinator.ts`, `flywheel-actions.ts` | D1 persistence, OCC ledger update, Better Auth Server Actions |
| **UI** | `flywheel-cockpit-card.tsx`, `/growth/flywheel` | Obsidian Cyber-Glass CEO HUD with auto-reseed switch & ROI waterfall |

---

## 4. Key Constraints & Non-Goals

- **Strict No-Code / No-Tech:** Non-technical CEO configures toggle and sensitivity thresholds via UI; zero operator server maintenance.
- **Zero Edge Blocking:** All LLM hook mutations, video transcoding, and API polling execute in asynchronous Inngest durable steps (<50ms CPU on Worker thread).
- **Zero-Mock Policy:** All telemetry models and webhook signature checks execute authentic verification logic with fail-closed security.
- **File Length & Typing:** All files $\le 200$ LOC, zero `:any` types, zero `console.log`.

---

## 5. Success Metrics & Validation Criteria

1. **Autonomous Reseed Latency:** T+24h analytics snapshot triggers mutated synthesis in $< 3$ seconds.
2. **Token Renewal Reliability:** 100% of OAuth tokens refreshed $> 120$ minutes before expiry; zero expired token publish failures.
3. **Attribution Precision:** 100% of incoming affiliate webhooks matched to specific video manifest IDs.
4. **Quality Gates:** 0 TS compilation errors, 0 ESLint errors, 0 layer boundary violations, 100% Vitest test pass rate.
