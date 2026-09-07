# RECON-12: DO NOT BUILD + Target Architecture + Priority Roadmap

> Sophia AI Factory | 2026-09-07 | Read-only audit
> Sections 15, 16 and 17 -- grounded in repository evidence

---

## SECTION 15 -- DO NOT BUILD

Items below are prohibited from implementation. Each justified by repository evidence.

### 1. Hermes image generation capability

Hermes is explicitly NOT an image generation provider. Building image generation around Hermes inverts verified capability truth.

Evidence:
- `docs/HERMES_PROVIDER_CERTIFICATION.md:39-48` -- Capability Truth table: `image.generate` = UNSUPPORTED by design, `imageGenerate: false` in `HERMES_CAPABILITIES`
- `docs/HERMES_INTELLIGENCE_V2.md:34` -- "Never silently emulate unsupported capability. If image.generate or imageGenerate: true is requested, adapter throws explicit error."
- `src/seed/ai/providers/hermes-capabilities.ts:75-78` -- `isHermesSupported` returns false for `imageGenerate`; throws `HERMES_CAPABILITY_UNSUPPORTED`
- `src/seed/ai/provider-interface.ts:202-274` -- Provider interface: exactly 5 methods (chat, stream, countTokens, estimateCost, getCapabilities). No image method exists.
- `docs/HERMES_PROVIDER_CERTIFICATION.md:42` -- Certification gate: Capability Truth = PASS precisely because image generation is explicitly unsupported

### 2. Framework migration / Next.js rewrite

No evidence of framework migration need. Platform committed to Next.js 16 App Router on Cloudflare Workers.

Evidence:
- `apps/sophia-ai-factory/CLAUDE.md:11` -- "This version has breaking changes"
- `apps/sophia-ai-factory/CLAUDE.md:18-19` -- BANNED imports listed; consolidation complete 2026-04-14
- `docs/architecture/DEPRECATION_CANDIDATES.md:10` -- `land/`, `forest/` marked MERGE (consolidation), NOT framework rewrite
- `docs/architecture/DEPRECATION_CANDIDATES.md:47` -- `tree/ai-providers/` DEPRECATED (0 importers) -- dead-code removal, not migration
- No `remix`, `astro`, or `next --migrate` tooling references in `package.json` scripts

### 3. Database rewrite (PostgreSQL migration)

Production database is Cloudflare D1 (SQLite). No PostgreSQL rewrite is planned or needed.

Evidence:
- `apps/sophia-ai-factory/CLAUDE.md:118-119` -- "Primary: Cloudflare D1 (SQLite). Secondary: Supabase only for OAuth callbacks, legacy shared flows."
- `docs/onboarding.md:16` -- "Legacy PostgreSQL migrations. Do not use Supabase migrations or clients in new code."
- `docs/codebase-audit/TECH_DEBT.md:12` -- Supabase folder contains deprecated PostgreSQL migrations; "is NOT fully obsoleted" only for JWKS token verification
- `docs/cloud-infrastructure.md:329` -- SQLite syntax reminder in production

### 4. Unnecessary frontend rewrite

Frontend committed to Next.js App Router + Tailwind + next-intl. No rewrite to React Server Components, Web Components, or alternative frameworks indicated.

Evidence:
- `apps/sophia-ai-factory/CLAUDE.md:95-97` -- Zero `:any` types, Zod validation, Server Actions for data mutations
- `apps/sophia-ai-factory/.claude/rules/sophia-design-authority.md:4-11` -- `globals.css` is single source of truth for CSS custom properties
- `docs/PHASE_GATES.md` -- G1 TypeScript compilation, G6 Production Routes Integrity enforce current stack stability
- No `components/` replacement or rewrite plan in `docs/architecture/`

### 5. Unnecessary microservices decomposition

All business logic consolidated in-process within the 4-layer structure. Microservices migration not indicated.

Evidence:
- `docs/architecture/DEPRECATION_CANDIDATES.md:10-14` -- `land/` and `forest/` marked MERGE (consolidation INTO fewer modules), not expansion into microservices
- `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md:8-40` -- 4-layer architecture is final form; no microservice targets documented
- `apps/sophia-ai-factory/CLAUDE.md:85-86` -- `npm run deploy:full` builds single OpenNext worker (`.open-next/worker.js`)
- ESLint `no-restricted-imports` enforces layer boundaries in-process (not cross-service)

### 6. Duplicate core orchestration engine

The Inngest client is already consolidated to a single canonical instance. A second orchestrator (Mekong, Buzz, or other) would be redundant.

Evidence:
- `src/seed/inngest/client.ts:1-19` -- "Canonical Inngest client. Only Inngest client instantiation in codebase."
- `src/forest/inngest/client.ts:3-12` -- "Forest Inngest client -- layer seam over canonical seed client." Re-export only.
- `docs/architecture/DEPRECATION_CANDIDATES.md:14` -- "Inngest engine: KEEP -- Core orchestration layer."
- `docs/architecture/MEKONG_BOUNDARY.md:8-11` -- Creating fourth orchestration layer causes "unclear ownership of task lifecycle, competing status reporting, race conditions."
- `docs/architecture/BUZZ_BOUNDARY.md:8` -- "Sophia operates without Mekong or Buzz integration."

### 7. Premature multi-agent swarm

General-purpose "swarm" orchestration layer is premature. Sophia has specific production graph (DAG) with approval gates.

Evidence:
- `src/tree/production-graph/templates.ts:1-10` -- Four built-in templates: `article-factory`, `video-brief`, `repurpose-derivative`, `creative-mission-full`. Linear DAGs with exactly one sink (publish node).
- `src/tree/production-graph/templates.ts:5` -- "DAG with exactly one sink, and the sink is the publish node."
- `src/forest/inngest/functions/production-graph-runner.ts:282-376` -- Generic publish gate enforcement via `isPublishNode` + `policy.requiresApproval(PUBLISH_CONTENT_TOOL)`
- `docs/architecture/BUZZ_BOUNDARY.md:8` -- "Do NOT create fourth orchestration layer"

### 8. Google Flow hard-coupling

No Google Flow integration exists or is indicated.

Evidence:
- Grep for "Google Flow" in `docs/` and `src/` returns zero matches
- `src/seed/ai/provider-interface.ts:28` -- ProviderId: `'openrouter' | 'Claude-Fable' | 'elevenlabs' | 'wan' | 'fish-speech' | 'hermes'` -- no Google Flow
- `docs/HERMES_PROVIDER_CERTIFICATION.md:106-119` -- Provider contract requires exactly 5 methods; Google Flow not claimed

### 9. Supabase migration to D1 (reverse direction)

Supabase is used for specific OAuth callbacks and legacy shared flows. Migrating those remaining flows is not indicated.

Evidence:
- `apps/sophia-ai-factory/CLAUDE.md:118-119` -- "Secondary: Supabase only for OAuth callbacks, legacy shared flows"
- `docs/codebase-audit/TECH_DEBT.md:12` -- Supabase "is NOT fully obsoleted" only for JWKS token verification in RaaS licensing layer
- No migration plan exists in `docs/architecture/` for removing Supabase

---

## SECTION 16 -- TARGET ARCHITECTURE

Smallest Claude-Fable architecture using 7 components. For each: CURRENT state, GAP, TARGET.

### CONTROL PLANE

**CURRENT:**
- `src/seed/inngest/client.ts:1-19` -- Single canonical Inngest client (consolidated Phase 1.6)
- `src/forest/inngest/functions/production-graph-runner.ts:209-220` -- Per-run BYOK provider registry + `resolveEffectiveAutonomy` policy resolution
- `src/forest/inngest/functions/production-graph-runner.ts:282-376` -- Publish approval gate via `requestApprovalAndAwait`
- `.github/workflows/deploy.yml` -- Active CI/CD: quality gate + wrangler deploy + SHA verification (restored 2026-05-03)
- `src/tree/production-graph/templates.ts:15-100` -- 4 deterministic linear DAG templates
- No external control plane (Mekong/Buzz not integrated -- `docs/architecture/MEKONG_BOUNDARY.md:8`)

**GAP:**
- `src/forest/inngest/functions/production-graph-runner.ts:381` -- `budgetRemainingCents` checks `mission.budgetCents - mission.spentCents` (user-supplied) but `policy.budgetCapCents` (per-run admin cap from `MissionTypePolicy`) is NEVER read by the runner -- verified: zero grep hits for `budgetCapCents` in the runner (only in test mocks)
- No `maxAutoRetries` enforcement in runner -- retry cap lives only in `agent-rollback-cron.ts:207-210`, which is a separate cron, not inline guard
- `mission_type_policies.maxCostCentsPerRun` has no automatic tier-based default; it is admin-configurable with no seed data

**TARGET:**
- Single Inngest control plane (seed client + forest functions). No second orchestrator.
- Runner must enforce `policy.budgetCapCents` as inline per-node guard (currently orphaned field)
- Runner must enforce `policy.maxAutoRetries` inline (currently only in rollback cron)
- `mission_type_policies` rows auto-seeded from tier config on workspace creation

---

### INTELLIGENCE PROVIDERS

**CURRENT:**
- `src/seed/ai/provider-interface.ts:202-274` -- Provider interface: exactly 5 methods (chat, stream, countTokens, estimateCost, getCapabilities). `health()` NOT in interface.
- `src/seed/ai/provider-health.ts` -- `ProviderHealthTracker` (external health tracking, not part of Provider contract)
- `src/seed/ai/provider-registry.ts` -- In-memory `Map<ProviderId, RegistryEntry>`
- `src/forest/ai/cost-aware-router.ts:336-411` -- `rankCost()`: unmetered/unknown treated as `(cheapestMeteredCost + EPSILON)` -- never ranked above measured provider
- `docs/HERMES_PROVIDER_CERTIFICATION.md:8-21` -- Hermes: Security BLOCKED, Health BLOCKED, Capability Truth PASS, Reliability PASS, Circuit Breaker PASS, Economics PASS, Canary BLOCKED, Production NOT READY

**GAP:**
- Hermes blocked on Security gate (hardcoded OAuth in external repo -- `docs/HERMES_PROVIDER_CERTIFICATION.md:14`)
- `src/seed/ai/provider-registry.ts` -- Hermes NOT registered in `provider-registry.ts` (certification Appendix confirms)
- Only OpenRouter and Claude-Fable are production-ready BYOK providers (customer keys via Setup Wizard)

**TARGET:**
- Keep provider interface at 5 methods; do NOT add `health()` (ProviderHealthTracker handles it externally -- `docs/HERMES_PROVIDER_CERTIFICATION.md:117-119`)
- Hermes: unblock Security gate (rotate hardcoded OAuth credentials). Until then, no production use.
- Register Hermes in `provider-registry.ts` after Security gate passes
- Maintain cost-aware router behavior: unmetered never beats measured

---

### CREATIVE PROVIDERS

**CURRENT:**
- `src/seed/ai/providers/hermes-capabilities.ts:32-52` -- `HERMES_CAPABILITIES` truth table: chat, stream, creative.reason, creative.storyboard, creative.prompt.optimize, vision=input-only, image.generate=unsupported
- `src/seed/types/creative-intelligence.ts`, `creative-storyboard.ts` -- Zod-validated contracts (creative reasoning, storyboard, prompt optimization)
- `src/tree/production-graph/templates.ts:15-100` -- 4 production graph templates (article-factory, video-brief, repurpose-derivative, creative-mission-full)
- `docs/PRODUCTION_FACTORY.md:56-89` -- Production graph DAG with autonomy tiers L0-L3, approval gates

**GAP:**
- Hermes is not production-ready (Security BLOCKED, Canary BLOCKED -- `docs/HERMES_PROVIDER_CERTIFICATION.md:141-147`)
- Creative contracts exist but are not exercised end-to-end in production
- `creative-mission-full` template has 10 nodes (scout through learning) -- the longest DAG; no evidence of production runs

**TARGET:**
- Same 5-method provider interface extended with creative capability contracts
- Hermes unblocked for production AFTER Security gate passes
- Creative contracts validated in production graph runner output assertions
- Capability truth preserved -- never emulate unsupported image generation

---

### MEDIA PIPELINE

**CURRENT:**
- `src/land/video/generation/video-job-pipeline.ts` -- Video job pipeline
- `src/forest/publishing/oauth-platform-refreshers.ts` -- OAuth token refresh for publishing channels
- `docs/architecture/DISTRIBUTION_OS.md:20-29` -- Phase 5 YouTube adapter, Phase 6 Telegram adapter (existing)
- `src/tree/production-graph/templates.ts:39,59,76,99` -- All 4 templates have exactly one publish node as DAG sink

**GAP:**
- Media pipeline fragmented across `land/video/`, `land/publishing/`, `land/youtube/`
- No unified distribution dispatcher consolidating channel-specific OAuth refresh + scheduling
- No per-channel circuit breakers on distribution (only generic provider circuit breaker exists -- `src/seed/security/circuit-breaker.ts`)

**TARGET:**
- Consolidate into unified media pipeline using Inngest functions (forest-to-land orchestration, per `cross-layer-orchestration.md`)
- Preserve protected distribution channels (YouTube OAuth flow, Telegram bot -- `docs/architecture/DISTRIBUTION_OS.md:20-29`)
- Per-channel circuit breakers (`circuit-breaker.ts`) keyed by channel ID

---

### QUALITY GATES

**CURRENT:**
- `docs/quality/PHASE_GATES.md` -- G1-G6 gates (TypeScript compilation, ESLint, tests, deploy, secrets, routes)
- `.github/workflows/quality-gate.yml` -- Active on pull_request: Gate 1 (type-check + lint + test + build) on self-hosted runner
- `.github/workflows/security-scan.yml` -- Active on pull_request: Gate 2 security scan
- `.github/workflows/deploy-2-guard.yml` -- Active: 2-party approval for deploys
- `apps/sophia-ai-factory/eslint-suppressions.json` -- Baseline frozen; new suppressions forbidden
- `apps/sophia-ai-factory/CLAUDE.md:95-97` -- Zero `:any` types, no `console.log` in production code

**GAP:**
- `docs/quality/PHASE_GATES.md` does not document G7 (production readiness) or G8 (SOC 2)
- No automated SHA-match pre-merge gate (SHA verification is post-deploy only -- `sophia-deploy-verify.md:44-53`)

**TARGET:**
- Same G1-G6 structure, plus SHA-match verification as a pre-merge check
- Active GitHub Actions CI/CD (deploy.yml + quality-gate.yml + security-scan.yml) as primary quality enforcement
- Production SHA verification post-deploy (already in `sophia-deploy-verify.md:44-53`)

---

### BILLING

**CURRENT:**
- `apps/sophia-ai-factory/src/land/billing/` -- NOWPayments IPN + tier activation (protected flow)
- `src/seed/config/tiers/unified-limits.ts:13-42` -- BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4,999
- `src/seed/config/tiers/tier-configs.ts:13-30` -- NOWPayments invoice IDs per tier
- `apps/sophia-ai-factory/CLAUDE.md:112` -- "NOWPayments is primary payment provider; PayOS is Vietnam domestic backup. Polar.sh and PayPal are banned."
- `src/app/api/webhooks/nowpayments/route.ts:189` -- Atomic lock: `INSERT ... ON CONFLICT DO NOTHING on payment_events.event_id`
- `src/land/creative-mission/actions.ts:65` -- `budgetCents: z.number().min(0)` -- user-supplied, no tier-based auto-cap

**GAP:**
- `src/app/api/webhooks/nowpayments/route.ts` writes to `payment_events` ONLY -- confirmed: zero references to `performance_event`, `recordPerformanceEvent`, or `value_cents` in `src/land/billing/`
- `src/land/creative-economy/dashboard-summary.ts:68` reads `performance_events` WHERE `event_type IN ('revenue', 'conversion', 'impression')` -- revenue card shows $0 until `revenue` events are ingested
- No automated revenue reconciliation bridging `payment_events` to `performance_events`
- `mission_type_policies.maxCostCentsPerRun` has no automatic tier-based default -- admin must manually configure per workspace

**TARGET:**
- Same NOWPayments IPN + tier activation chain (protected flow, never break)
- Bridge: `payment_events` (NOWPayments IPN) written to `performance_events` with `event_type='revenue'` for creative-economy dashboard
- `mission_type_policies` rows auto-seeded from tier config on workspace creation, enforcing `maxCostCentsPerRun` per tier
- Revenue reconciliation automated (daily cron bridging payment_events to performance_events)

---

### OBSERVABILITY

**CURRENT:**
- `src/seed/observability/sentry-forwarder.ts`, `sentry-symbolication-opt-in.ts` -- Sentry SDK wired
- `docs/observability-runbook.md` -- OpenTelemetry staging verified (tracing to Honeycomb)
- `src/seed/security/circuit-breaker.ts:28` -- CircuitBreakerOptions + `shouldAllowRequest`/`recordSuccess`/`recordFailure`
- `apps/sophia-ai-factory/CLAUDE.md (handover rules):104-110` -- Monitoring 8/10 (errors captured; sourcemaps optional)
- `apps/sophia-ai-factory/CLAUDE.md (handover rules):58-61` -- `SENTRY_AUTH_TOKEN` optional; source maps minified if absent

**GAP:**
- `SENTRY_AUTH_TOKEN` optional -- source maps minified without it (per no-tech doctrine, operator does NOT provide this)
- No production OpenTelemetry rollout yet (staging only)
- `wrangler tail` is canonical real-time error stream but requires operator action to invoke

**TARGET:**
- Same Sentry + OpenTelemetry stack; source symbolication optional (per no-tech doctrine -- `sophia-no-tech-doctrine.md:46`)
- `wrangler tail` remains canonical real-time error stream
- Circuit breaker integration on all external HTTP calls (already enforced -- `CLAUDE.md:89-90`)

---

## SECTION 17 -- PRIORITY ROADMAP

### HORIZON 1 -- FOUNDATION (only blockers)

#### H1.1: Unblock Hermes Security Gate

**WHY:** Hermes is the only local (unmetered) intelligence provider but Security gate is BLOCKED (`docs/HERMES_PROVIDER_CERTIFICATION.md:8-21`). Until unblocked, no Hermes production use, no canary, no economic honesty verification.

**DEPENDENCY:** External Hermes repo (`bridge/auth.py`) must rotate hardcoded `DEFAULT_CLIENT_SECRET`. Requires external account owner action (`docs/HERMES_PROVIDER_CERTIFICATION.md:14-15` -- "requires the actual account owner's action -- outside this audit's scope").

**RISK:** Cannot verify rotation locally. External dependency outside repo control. May require new OAuth client registration.

**EXPECTED OUTCOME:** Hermes Security gate PASS. Hermes registered in `provider-registry.ts`. Canary activated (1% -> 10% -> 100%). Economic ranking verified against live provider.

---

#### H1.2: Wire budgetCapCents enforcement in production-graph-runner

**WHY:** `src/seed/types/production-factory.ts:58` defines `maxCostCentsPerRun: number | null` in `MissionTypePolicy`. `src/tree/autonomy/effective-autonomy.ts:78` resolves it to `budgetCapCents`. But the runner at `src/forest/inngest/functions/production-graph-runner.ts:381` ONLY checks `mission.budgetCents - mission.spentCents` (user-supplied mission budget). The per-run admin cap (`policy.budgetCapCents`) is NEVER read by the runner -- confirmed: zero grep hits for `budgetCapCents` in production-graph-runner.ts (only in test mocks).

**DEPENDENCY:** `src/tree/autonomy/effective-autonomy.ts` (already resolves `budgetCapCents`), `src/forest/inngest/functions/production-graph-runner.ts` (must add guard before node execution).

**RISK:** L3 full-auto runs could exceed per-run budget without runtime caps. `creative-mission-full` template has 10 nodes; cost accumulation across nodes has no per-run ceiling.

**EXPECTED OUTCOME:** Runner enforces `policy.budgetCapCents` as inline per-node guard. Per-run cost accumulation halts when cap reached.

---

#### H1.3: Auto-seed mission_type_policies from tier config

**WHY:** `src/land/creative-mission/actions.ts:65` accepts `budgetCents: z.number().min(0)` -- user-supplied, no tier-based auto-cap. `mission_type_policies` has no automatic tier-based default; admin must manually configure `maxCostCentsPerRun` per workspace. Without auto-seeding, workspace owners can set arbitrary budgets with no tier enforcement.

**DEPENDENCY:** `src/seed/config/tiers/unified-limits.ts` (tier definitions), `src/tree/autonomy/policy-repo.ts` (mission_type_policies CRUD), workspace creation flow.

**RISK:** Tier budget violations invisible until cost accumulation exceeds tolerance. No guardrail between tier subscription price and production graph cost.

**EXPECTED OUTCOME:** On workspace creation, `mission_type_policies` rows auto-seeded with `maxCostCentsPerRun` derived from tier config. Tier-enforced budget caps active by default.

---

### HORIZON 2 -- FACTORY (capabilities that materially increase autonomous production)

#### H2.1: Creative memory store consolidation

**WHY:** Multiple memory files exist across layers duplicating the canonical `tree/creative-memory/` store. `docs/architecture/DEPRECATION_CANDIDATES.md:34-39` identifies consolidation targets. Single `ICreativeMemoryStore` contract reduces memory fragmentation across autonomous runs.

**DEPENDENCY:** `src/tree/creative-memory/` (KEEP target per DEPRECATION_CANDIDATES.md), `src/forest/memory/`, `src/forest/agent-chat/memory-consolidation-service.ts`, `src/tree/learning/learning-loop.ts`.

**RISK:** Learning loop is wired to `production-graph-runner.ts` via `creative_missions.mission_type` column. Breaking changes risk existing missions.

**EXPECTED OUTCOME:** Single memory contract; all ad-hoc memory files migrated to `ICreativeMemoryStore`. Existing mission data preserved.

---

#### H2.2: Publish approval gate audit

**WHY:** `src/forest/inngest/functions/production-graph-runner.ts:282-284` enforces approval on ALL publish nodes generically (`isPublishNode && policy.requiresApproval(PUBLISH_CONTENT_TOOL)`). This is architecturally correct. However, need to verify all 4 templates (`src/tree/production-graph/templates.ts:32,48,69,88`) correctly mark their publish node with `isPublishNode: true`.

**DEPENDENCY:** `src/tree/production-graph/templates.ts` (4 templates verified: article-factory:39, video-brief:59, repurpose-derivative:76, creative-mission-full:99 -- all have `isPublishNode: true` on their sink node).

**RISK:** If any template omits `isPublishNode` on its publish node, content goes live without customer approval.

**EXPECTED OUTCOME:** Documented verification that all 4 templates enforce publish gate. Test coverage for gate bypass scenarios.

---

#### H2.3: Cross-channel distribution consolidation

**WHY:** YouTube adapter (Phase 5) and Telegram adapter (Phase 6) exist but no unified distribution dispatcher consolidates channel-specific OAuth refresh + scheduling. `src/forest/publishing/oauth-platform-refreshers.ts` handles refresh but not scheduling or circuit breaking.

**DEPENDENCY:** `docs/architecture/DISTRIBUTION_OS.md:20-29`, `src/forest/publishing/oauth-platform-refreshers.ts`, `src/seed/security/circuit-breaker.ts`.

**RISK:** Channel-specific rate limits not centralized; quota exhaustion on one channel could block others. Telegram bot is a protected flow -- breaking it breaks customer interface.

**EXPECTED OUTCOME:** Single distribution dispatcher with per-channel circuit breakers (`circuit-breaker.ts` keyed by channel ID). Protected flows preserved.

---

### HORIZON 3 -- SCALE (capabilities that materially increase revenue, throughput, reliability, or margin)

#### H3.1: Revenue reconciliation bridge (payment_events to performance_events)

**WHY:** NOWPayments IPN route (`src/app/api/webhooks/nowpayments/route.ts:189`) writes to `payment_events` ONLY -- confirmed zero references to `performance_event`, `recordPerformanceEvent`, or `value_cents` in `src/land/billing/`. The creative-economy dashboard (`src/land/creative-economy/dashboard-summary.ts:68`) reads `performance_events` WHERE `event_type IN ('revenue', 'conversion', 'impression')`. Revenue card shows $0 until `revenue` events are ingested. This is a confirmed gap.

**DEPENDENCY:** `src/app/api/webhooks/nowpayments/route.ts`, `src/land/creative-economy/dashboard-summary.ts`, `src/tree/performance.ts` (`recordPerformanceEvent`), `migrations/` (may need `performance_events` schema verification).

**RISK:** Revenue dashboard shows $0 with no warning. Operator cannot see actual revenue without manual SQL queries. Customer-facing creative-economy page misleads users.

**EXPECTED OUTCOME:** NOWPayments IPN handler writes `performance_events` with `event_type='revenue'` and `value_cents` from payment amount. Creative-economy dashboard reflects real revenue.

---

#### H3.2: Real-time tier quota enforcement

**WHY:** `src/forest/quota/quota-enforcer.ts:33-67` enforces quota for RaaS (AI commands, MCU). `src/forest/quota/provider-pool.ts:64-65` checks `getUserTier` + `checkVideoQuota`. But `src/land/creative-mission/actions.ts:65` accepts user-supplied `budgetCents` with no tier-based auto-cap. Production graph cost accumulation has no real-time quota enforcement beyond per-node budget check.

**DEPENDENCY:** `src/seed/config/tiers/unified-limits.ts`, `src/forest/quota/quota-enforcer.ts`, `src/seed/kv/quota-cache-ops.ts`, `src/forest/quota/provider-pool.ts`.

**RISK:** Over-usage not caught in real-time; customer hits hard limit mid-campaign. Mission continues accumulating cost past tier threshold.

**EXPECTED OUTCOME:** Real-time quota enforcement via KV cache (`src/seed/kv/quota-cache-ops.ts`) with circuit-breaker-style fail-open. Tier budget enforced at both mission creation (H1.3) and per-node execution (H1.2).

---

#### H3.3: Multi-region media pipeline

**WHY:** Video generation is single-region (Cloudflare Workers). `apps/sophia-ai-factory/CLAUDE.md:85-86` -- single `.open-next/worker.js`. Scale requires regional worker routing + shared KV namespace for cross-region cache.

**DEPENDENCY:** Cloudflare Workers multi-region support, OpenNext build pipeline, R2 + KV namespace sharing across regions.

**RISK:** R2 cache consistency across regions; D1 read-replica lag. CF Workers cold start variance across regions.

**EXPECTED OUTCOME:** Media pipeline scales horizontally. 90th-percentile video generation latency reduced by >=40%.

---

## COMPACT SUMMARY

```
SECTION 15 -- DO NOT BUILD (9 items):
  1. Hermes image generation (capability truth: unsupported by design)
  2. Framework migration (Next.js 16 committed)
  3. Database rewrite (D1 SQLite canonical)
  4. Frontend rewrite (App Router + next-intl committed)
  5. Microservices decomposition (4-layer in-process model)
  6. Duplicate core orchestration (single canonical Inngest client)
  7. Premature multi-agent swarm (4 DAG templates sufficient)
  8. Google Flow hard-coupling (no references exist)
  9. Supabase migration removal (OAuth/JWKS still needed)

SECTION 16 -- TARGET ARCH (7 components):
  CONTROL PLANE:       Single Inngest + forest functions. No Mekong/Buzz.
                        Wire orphaned budgetCapCents + maxAutoRetries in runner.
  INTELLIGENCE PROVIDERS: 5-method interface (no health()). Hermes blocked until Security gate passes.
  CREATIVE PROVIDERS:  Capability truth preserved. Creative contracts Zod-validated.
  MEDIA PIPELINE:      Consolidate land/video + land/publish + land/youtube into Inngest-driven pipeline.
  QUALITY GATES:       G1-G6 + active CI/CD (deploy.yml + quality-gate.yml + security-scan.yml).
  BILLING:             NOWPayments IPN -> performance_events bridge needed. Tier auto-seed needed.
  OBSERVABILITY:       Sentry staged. wrangler tail canonical. OpenTelemetry prod rollout.

SECTION 17 -- ROADMAP:
  H1 (Foundation):    Unblock Hermes security, wire budgetCapCents in runner, auto-seed tier policies.
  H2 (Factory):       Memory store consolidation, publish gate audit, distribution consolidation.
  H3 (Scale):         Revenue reconciliation bridge, real-time quota enforcement, multi-region pipeline.

KEY VERIFIED FINDING:
  budgetCapCents (MissionTypePolicy.maxCostCentsPerRun) is resolved by effective-autonomy.ts:78
  but NEVER read by production-graph-runner.ts -- orphaned field. Runner only checks
  user-supplied mission.budgetCents (line 381), not the admin tier cap.

  NOWPayments IPN route writes to payment_events ONLY. Creative-economy dashboard reads
  performance_events -- confirmed: zero bridge between these tables.
```

---

## APPENDIX: Evidence Sources

| File | Lines | Purpose |
|---|---|---|
| `apps/sophia-ai-factory/CLAUDE.md` | 85-86, 95-97, 112, 118-119 | Deploy doctrine, quality gates, billing, DB |
| `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md` | 8-40 | 4-layer architecture |
| `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md` | 44-53 | SHA verification |
| `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` | 46, 58-61 | Operator platform-only |
| `src/seed/ai/provider-interface.ts` | 202-274 | Provider interface (5 methods) |
| `src/seed/ai/provider-health.ts` | full | ProviderHealthTracker (external) |
| `src/seed/ai/provider-registry.ts` | full | In-memory registry |
| `src/seed/ai/providers/hermes-capabilities.ts` | 32-78 | Capability truth |
| `src/forest/ai/cost-aware-router.ts` | 336-411 | Unmetered cost ranking |
| `src/seed/config/tiers/unified-limits.ts` | 13-42 | Tier pricing |
| `src/seed/config/tiers/tier-configs.ts` | 13-30 | NOWPayments invoice IDs |
| `src/seed/types/production-factory.ts` | 45-65 | MissionTypePolicy (budgetCapCents) |
| `src/tree/autonomy/effective-autonomy.ts` | 70-90 | Budget resolution (orphaned) |
| `src/forest/inngest/functions/production-graph-runner.ts` | 209-220, 282-376, 381 | Runner: policy, approval, budget |
| `src/tree/production-graph/templates.ts` | 15-100 | 4 DAG templates |
| `src/land/creative-mission/actions.ts` | 65, 154 | User-supplied budgetCents |
| `src/land/creative-economy/dashboard-summary.ts` | 68-79 | Revenue reads performance_events |
| `src/app/api/webhooks/nowpayments/route.ts` | 189 | IPN writes payment_events ONLY |
| `docs/HERMES_PROVIDER_CERTIFICATION.md` | 8-21, 39-48, 117-119 | Hermes gate status |
| `docs/HERMES_INTELLIGENCE_V2.md` | 34 | Capability truth rule |
| `docs/architecture/DEPRECATION_CANDIDATES.md` | 10, 14, 34-39, 47 | Consolidation targets |
| `docs/architecture/MEKONG_BOUNDARY.md` | 8-11 | No fourth orchestration layer |
| `docs/architecture/BUZZ_BOUNDARY.md` | 8 | Sophia independent of Buzz |
| `docs/quality/PHASE_GATES.md` | full | G1-G6 gates |
| `.github/workflows/deploy.yml` | full | Active CI/CD |
| `.github/workflows/quality-gate.yml` | full | Active quality gate |
| `.github/workflows/security-scan.yml` | full | Active security scan |
