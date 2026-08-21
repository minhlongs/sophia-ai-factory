# Repository Reconnaissance Report — 2026-08-17

Generated as part of SOPHIA 2027 Transformation Mission (CREATIVE ECONOMY OS).

---

## 1. Current Architecture

**Monorepo** at `/Users/macbook/sophia-ai-factory/`

| Component | Path | Description |
|---|---|---|
| Main App | `apps/sophia-ai-factory/` | Next.js 16 App Router SaaS — AI Video Generation |
| 84tea | `apps/84tea/` | Secondary app |
| Plans | `apps/plans/` | Planning tooling |
| Sophia Proposal | `apps/sophia-proposal/` | Proposal generator |
| Sophia Video Bot | `apps/sophia-video-bot/` | Video bot service |
| Coqui TTS | `services/coqui-tts/` | Text-to-speech service |
| MoviePy Render | `services/moviepy-render/` | Video rendering service |
| RunPod Hunyuan | `services/runpod-hunyuan/` | Hunyuan video model on RunPod |

**Main app layer architecture** (inside `apps/sophia-ai-factory/src/`):

| Layer | Directory | Purpose |
|---|---|---|
| **Seed** | `seed/` | Foundation primitives — AI, auth, DB, billing, config, Inngest, observability, services, templates, types, validation |
| **Tree** | `tree/` | Domain logic — agents, AI providers, BYOK, compliance, provenance, publishing, quota, SOPS, streaming, Telegram, telemetry, TikTok, tracking, video, voice, webhooks, workflows, YouTube |
| **Forest** | `forest/` | Workflow orchestration — admin, affiliates, agent-fleet, agents, AI providers, alerts, API, audit, autonomy, billing, branding, budget, clients, compliance, etc. |
| **Land** | `land/` | Route handlers / UI logic — campaigns, creative-mission, autonomy, analytics, billing, checkout, DID, workflows, video, voice, YouTube, TikTok, agent-chat, alerts, affiliates, etc. |
| **App** | `app/` | Next.js App Router pages and API routes |

---

## 2. Runtime Topology

- **Runtime**: Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Framework**: Next.js 16 App Router
- **Deployment**: `npm run deploy:full` → Cloudflare Workers
- **Production URL**: `https://sophia.agencyos.network`
- **Branch**: `main` (HEAD: `1bb074e70`)
- **Version**: 0.1.5

---

## 3. Data Topology

| Store | Purpose | Notes |
|---|---|---|
| **Cloudflare D1** | Primary database | Via `createServerClient()` (sync, no await). 17 migrations (init → agent-factory) |
| **Supabase** | Secondary | OAuth callbacks, legacy shared flows |
| **Cloudflare R2** | Object storage | Video assets, images |
| **Cloudflare KV** | Key-value cache | Rate limiting, sessions |
| **Inngest** | Background jobs | Long-running workflows (video generation, multi-step processes) |

**D1 Migrations** (17 files): init, payment-events, better-auth, error-logs, user-profiles, signals-events, users-local-mode, workflows, LLM-cache (3 versions), user-api-keys, rate-limits, export-jobs, tier-change-events, agent-factory, JWT-nonces.

---

## 4. Agent Topology

| System | Location | Status |
|---|---|---|
| **Agent Chat** | `land/agent-chat/` | Streaming chat with system prompts |
| **Agent Fleet** | `forest/agent-fleet/` | Agent fleet management |
| **Agent Factory** | `tree/agents/`, D1 migration 0016 | Agent creation/management |
| **Agent Performance** | `land/analytics/agent-performance-resolver.ts` | Performance tracking |
| **Agent Alerts** | `land/alerts/realtime-alert-*.ts` | Real-time alerting |

No standardized agent protocol exists. Agents are ad-hoc implementations across layers.

---

## 5. AI Provider Topology

| File | Purpose |
|---|---|
| `seed/ai/provider-interface.ts` | Provider interface abstraction |
| `seed/ai/provider-registry.ts` | Provider registry |
| `seed/ai/multi-provider-router.ts` | Multi-provider routing |
| `seed/ai/llm-router.ts` | LLM-specific routing |
| `seed/ai/provider-scoring.ts` | Provider scoring/selection |
| `seed/ai/cost-estimator.ts` | Cost estimation |
| `seed/ai/token-counter.ts` | Token counting |
| `seed/ai/provider-health.ts` | Provider health monitoring |
| `seed/ai/anthropic-adapter.ts` | Anthropic-specific adapter |
| `seed/ai/elevenlabs-api-client.ts` | ElevenLabs TTS |
| `seed/ai/video-generator.ts` | Video generation |
| `seed/ai/script-generator.ts` | Script generation |
| `seed/ai/proposal-generator.ts` | Proposal generation |
| `seed/ai/conversation-summarizer.ts` | Conversation summarization |

**Key insight**: A model-agnostic provider abstraction ALREADY EXISTS in `seed/ai/`. This is a major strength. The 2027 vision can build on this rather than creating from scratch.

**External providers** (from config/CLAUDE.md):
- OpenRouter (LLM routing)
- ElevenLabs (TTS)
- D-ID (Avatar/video)
- RunPod (Hunyuan video model)
- Coqui TTS (self-hosted TTS)

---

## 6. Storage Topology

| System | Location | Purpose |
|---|---|---|
| R2 storage | `seed/r2/` | Object storage for video/image assets |
| Video storage | `land/video/storage/` | Video-specific storage logic |
| KV cache | `seed/kv/` | Key-value caching |
| Redis | `seed/redis.ts` | Redis abstraction |

---

## 7. Background-Job Topology

| System | Location | Purpose |
|---|---|---|
| **Inngest** | `seed/inngest/client.ts` | Primary background job framework |
| **Workflows** | `land/workflows/` | Workflow orchestration (supervisor-steps, compute-next) |
| **Cron** | `land/cron/` | Scheduled tasks |
| **Workers** | `src/workers/` | Cloudflare Workers (health, ultracode) |
| **Forest workflows** | `forest/workflows/` | Workflow definitions |

---

## 8. Auth/Billing Topology

| System | Location | Purpose |
|---|---|---|
| **Auth** | `seed/auth/` | Better Auth session management |
| **Auth routes** | `app/[locale]/login/`, `register/`, `reset-password/` | User auth UI |
| **Billing** | `land/billing/`, `seed/billing/` | NOWPayments IPN, usage tracking, tier enforcement |
| **Tier system** | `seed/config/tiers.ts`, `seed/db/get-user-tier.ts` | Tier management (BASIC/PREMIUM/ENTERPRISE/MASTER) |
| **Checkout** | `land/checkout/` | Payment checkout |
| **Affiliates** | `land/affiliates/` | Affiliate system (ClickBank, NOWPayments) |
| **White-label** | `land/billing/white-label.ts` | White-label billing |
| **BYOK** | `tree/byok/` | Bring Your Own Key management |

---

## 9. Existing Strengths

1. **Mature AI provider abstraction** (`seed/ai/`) — provider-interface, registry, multi-provider-router, cost-estimator, provider-scoring. Model-agnostic by design.
2. **Comprehensive analytics** (`land/analytics/`) — ROI, LTV, churn, cohorts, funnels, video benchmarks, real-time snapshots, SSE broadcasting.
3. **Full billing/monetization stack** — NOWPayments, affiliate system, usage tracking, tier enforcement, white-label.
4. **Video production pipeline** (`land/video/`) — assembly, generation, publishing, storage, templates, pricing.
5. **Distribution integrations** — YouTube OAuth, TikTok OAuth, publishing pipeline.
6. **Autonomy system** (`land/autonomy/`) — basic autonomy framework exists.
7. **Creative mission** (`land/creative-mission/`) — basic mission system exists.
8. **7,319 test files** — massive test coverage.
9. **Observability** (`seed/observability/`) — monitoring infrastructure.
10. **Alert system** (`land/alerts/`) — real-time alerts, webhook notifications.
11. **BYOK architecture** — customer self-input API keys via Setup Wizard.
12. **Compliance framework** (`seed/compliance/`, `tree/compliance/`).
13. **Provenance** (`tree/provenance/`) — already exists in tree layer.
14. **Inngest integration** — background job framework for long-running workflows.

---

## 10. Technical Debt

1. **No standardized agent protocol** — agents are ad-hoc across layers.
2. **No typed Creative Memory** — memory is implicit, not typed or versioned.
3. **No Creative Identity/DNA** — brand voice is prompt-based, not data-driven.
4. **No IP domain model** — IP relationships are not tracked.
5. **No Content Graph** — content lifecycle stages are not formally modeled.
6. **No Experiment Engine** — no A/B testing primitives.
7. **No canonical Performance Model** — analytics exist but no standardized metrics interface.
8. **No Autonomy Level Model** — basic autonomy exists but no level system.
9. **Mission system is minimal** — checkpoint.ts + actions.ts only.
10. **Layer boundaries are loose** — seed/land/tree/forest boundaries sometimes blur.

---

## 11. Duplicated Abstractions

| Concept | Locations | Status |
|---|---|---|
| AI Provider | `seed/ai/provider-interface.ts`, `tree/ai-providers/` | Potentially overlapping |
| Video generation | `seed/ai/video-generator.ts`, `land/video/` | Different levels (AI vs pipeline) |
| Workflows | `land/workflows/`, `forest/workflows/`, `seed/inngest/` | Three workflow systems |
| Billing | `land/billing/`, `seed/billing/` | Different concerns (UI vs primitives) |
| Agent management | `land/agent-chat/`, `forest/agent-fleet/`, `tree/agents/` | Ad-hoc, no unified protocol |

---

## 12. Dangerous Coupling

1. **Inngest client** (`seed/inngest/client.ts`) — single file, tightly coupled to Inngest service.
2. **D1 direct access** — `createServerClient()` is synchronous but D1 bindings are async (recent fix in commit `e05ffd241`).
3. **NOWPayments webhook** — production payment flow depends on correct IPN handling.
4. **Telegram bot webhook** — @Sophia_Bbot integration is production-critical.
5. **Setup Wizard** — BYOK onboarding must always work end-to-end.

---

## 13. Missing Abstractions

| Abstraction | Priority | Impact |
|---|---|---|
| **CreativeMemory** | CRITICAL | Cannot learn from past creative decisions |
| **CreativeIdentity** | CRITICAL | Cannot maintain consistent brand voice across agents |
| **Mission Lifecycle** | HIGH | Cannot orchestrate multi-step creative campaigns |
| **Agent Protocol** | HIGH | Cannot compose specialized agents |
| **Autonomy Levels** | HIGH | Cannot control human-in-the-loop granularity |
| **IP Graph** | MEDIUM | Cannot track derivative creative relationships |
| **Content Graph** | MEDIUM | Cannot track content lifecycle stages |
| **Experiment Engine** | MEDIUM | Cannot run A/B tests on creative decisions |
| **Performance Model** | MEDIUM | Cannot standardize metrics across platforms |
| **Distribution OS** | MEDIUM | Cannot orchestrate multi-platform publishing |
| **Provenance** | MEDIUM | Cannot track creative lineage (partially exists in tree/) |
| **Domain Model** | HIGH | No canonical entity definitions |

---

## 14. Production Risks

1. **Protected flows must not break**: Setup Wizard, Telegram Bot, NOWPayments webhook.
2. **7,319 test files** — large test suite, CI may be slow.
3. **Cloudflare Workers deployment** — must verify SHA match after deploy.
4. **D1 async binding** — recent migration from sync to async requires careful handling.
5. **BYOK credentials** — must never be exposed to frontend.

---

## 15. Migration Opportunities

1. **Strangler pattern for Creative Memory**: Add typed memory interfaces in `seed/`, gradually wrap existing implicit memory.
2. **Strangler pattern for Agent Protocol**: Define protocol in `seed/`, gradually migrate existing agents to conform.
3. **Strangler pattern for Mission Lifecycle**: Extend existing `land/creative-mission/` with lifecycle states.
4. **Build on existing provider abstraction**: `seed/ai/provider-interface.ts` is already model-agnostic — extend, don't replace.
5. **Build on existing analytics**: `land/analytics/` is comprehensive — add performance model layer on top.
6. **Build on existing publishing**: `land/publishing/` + YouTube/TikTok OAuth — add distribution abstraction layer.

---

## 16. What MUST NOT Be Rewritten

1. **`seed/ai/provider-interface.ts`** — already model-agnostic, extend only.
2. **`seed/auth/`** — Better Auth session management, production-tested.
3. **`seed/db/client.ts`** — D1 client, production-tested.
4. **`seed/config/tiers.ts`** — Tier system, production-tested.
5. **`land/billing/nowpayments-ipn-*.ts`** — Payment webhook handling, production-critical.
6. **`land/agent-chat/`** — Streaming chat, production-tested.
7. **`land/video/`** — Video production pipeline, production-tested.
8. **`land/analytics/`** — Comprehensive analytics, production-tested.
9. **`app/[locale]/setup-wizard/`** — BYOK onboarding, protected flow.
10. **Telegram bot integration** — Protected flow.
11. **All existing API routes** — Never remove or break.

---

## 17. What Should Be Deprecated

| Candidate | Reason | Action |
|---|---|---|
| Duplicate workflow systems | `land/workflows/` + `forest/workflows/` + `seed/inngest/` | Consolidate into single workflow abstraction |
| Ad-hoc agent implementations | No protocol, inconsistent interfaces | Migrate to standardized Agent Protocol |
| Implicit memory | No typed interfaces, no versioning | Replace with CreativeMemory |

---

## 18. What Should Become Reusable Platform Primitives

1. **`seed/ai/provider-interface.ts`** → AI Provider Abstraction (already is)
2. **`seed/ai/cost-estimator.ts`** → Cost Accounting Primitive (extend)
3. **`seed/ai/provider-scoring.ts`** → Model Routing Policy (extend)
4. **`land/analytics/`** → Performance Intelligence Layer (wrap)
5. **`land/publishing/`** → Distribution OS Primitive (extend)
6. **`tree/provenance/`** → Provenance Layer (extend)
7. **`seed/inngest/`** → Workflow Engine Primitive (keep as-is)
8. **`seed/observability/`** → Observability Primitive (extend)
9. **`land/autonomy/`** → Autonomy Level System (extend)

---

## Summary

Sophia AI Factory is a **mature, production-deployed SaaS platform** with 7,319 test files, comprehensive analytics, a model-agnostic AI provider system, full billing/monetization, video production pipeline, and distribution integrations.

The 2027 transformation does NOT require building from scratch. It requires:

1. **Adding missing domain primitives** (CreativeMemory, CreativeIdentity, Mission Lifecycle, Agent Protocol, Autonomy Levels)
2. **Extending existing strengths** (provider abstraction, analytics, publishing, provenance)
3. **Creating canonical domain model** (unified entity definitions)
4. **Documenting boundaries** (Mekong, Buzz, Sophia)
5. **Implementing the constitution** (strategic document)

The strangler pattern is ideal: add new layers on top, migrate gradually, never break production.
