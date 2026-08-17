# Repository Reconnaissance — 2026-08-17

## Current Architecture

### Runtime Topology
- **Framework**: Next.js 16.2.5 (App Router, React 19.2.3)
- **Runtime**: Cloudflare Workers (OpenNext build)
- **Language**: TypeScript strict
- **Testing**: Vitest 4.x
- **i18n**: next-intl v4 (Vietnamese primary, English secondary)
- **Current SHA**: `00c7c393` (main)

### 4-Layer Architecture (seed → tree → forest → land)

| Layer | Path | Purpose | File Count |
|---|---|---|---|
| seed | src/seed/ | Foundational primitives: types, config, db client, auth base, security utils, logger | ~147 |
| tree | src/tree/ | Domain-specific reusable: bot logic, BYOK store, handover, audit, telegram | ~162 |
| forest | src/forest/ | Reusable infrastructure: Inngest jobs, RAAS gateway, usage metering, quota | ~362 |
| land | src/land/ | Business workflows: billing, payouts, affiliates, promo, refunds, publish | ~113 |

**Import rules**:
- seed → any layer
- tree → seed
- forest → seed, tree (+ may CALL land for orchestration)
- land → seed, tree, forest

**BANNED**: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`

### Data Topology
- **Primary DB**: Cloudflare D1 (SQLite) via `createServerClient()` — synchronous, no await
- **Secondary**: Supabase (Postgres) — OAuth callbacks, legacy shared flows only
- **Migrations**: `migrations/` directory, applied via `scripts/apply-migrations.sh`
- **Latest migration**: `0231_whatsapp_approval_gate.sql`
- **Cache**: R2 (`NEXT_INC_CACHE_R2_BUCKET`)
- **KV**: `tagCache` for revalidation

### AI Provider Topology
Current integrations (BYOK):
- OpenRouter (primary LLM gateway)
- ElevenLabs (TTS/voice)
- HeyGen/D-ID (avatar video)
- MuAPI (100+ models)
- Replicate, fal.ai

Pattern: circuit breaker on all external HTTP calls. Failure kind classification: AUTH_FAILURE → immediate open, RATE_LIMIT → cooldown, SERVER_ERROR → retry with backoff.

### Agent Topology
- **Inngest**: background job orchestration (video generation, multi-step workflows)
- **Forest agents**: agent-chat, agents, ai, alerts, analytics, ingestion, inngest
- **Telegram Bot**: @Sophia_Bbot — `/campaign`, `/status`, `/results` commands
- **No formal agent protocol yet** — agents are functional modules, not typed contracts

### Storage Topology
- **D1**: relational data (users, videos, jobs, templates, billing)
- **R2**: video assets, backups (30-day lifecycle)
- **KV**: cache/tagCache
- **BYOK**: customer API keys stored encrypted server-side

### Auth/Billing Topology
- **Auth**: Better Auth v1.6.2 (email/password, magic link, org plugin)
- **Session**: `getCurrentUser()` from `@/seed/auth/better-auth-session`
- **Billing**: NOWPayments (USDT) + PayOS (Vietnam domestic) IPN webhook → tier activation
- **Tiers**: BASIC($199) / PREMIUM($399) / ENTERPRISE($799) / MASTER($4,999)
- **Banned**: Polar.sh, PayPal

## Existing Strengths
1. Clean 4-layer architecture enforced
2. Circuit breaker pattern on all external calls
3. Result<T,E> pattern — no throws in business logic
4. BYOK doctrine — customer owns all credentials
5. Bilingual i18n (VI/EN)
6. CF-direct deploy with SHA verification
7. TypeScript strict, zero `:any` policy
8. Inngest for long-running workflows
9. D1 migrations tracked + apply script
10. WhatsApp platform just shipped (security-verified)

## Technical Debt
1. ~650+ TODO/FIXME/HACK/XXX comments in src/ (needs audit)
2. Duplicate auth patterns in some legacy routes
3. No formal agent protocol — agents are loose functions
4. No creative memory — context is prompt-only
5. No IP graph — content is flat
6. No provenance tracking
7. No experiment engine
8. Stryker baseline blocked (babel instrumenter can't parse top-level await)
9. Some test files reference stale interfaces
10. No performance intelligence beyond basic analytics

## Duplicated Abstractions
1. Agent patterns repeated across `forest/agent-chat/`, `forest/agents/`, `forest/ai/` — no shared contract
2. Auth checks duplicated in some API routes instead of middleware
3. Video/content abstractions scattered across land/forest/tree

## Dangerous Coupling
1. Some land modules depend on forest orchestration (documented exception, but grows)
2. Billing state machine tightly coupled to NOWPayments IPN format
3. Telegram bot commands coupled to specific D1 schema

## Missing Abstractions
1. **Creative Memory** — no persistent memory of voice/style/audience/performance
2. **Agent Protocol** — no shared AgentDefinition/AgentInput/AgentResult contract
3. **IP Graph** — no first-class IP entities (character, story, universe)
4. **Content Graph** — no lineage tracking (concept → script → asset → derivative)
5. **Mission** — no top-level orchestration object
6. **Autonomy Levels** — no permissioned execution model
7. **Provenance** — no append-only audit trail for generated content
8. **Signal Provider** — no market intelligence abstraction
9. **Experiment Engine** — no A/B testing primitive
10. **Provider Abstraction** — BYOK keys scattered, no unified adapter

## Production Risks
1. **No circuit breaker on Telegram API calls** (bot commands bypass pattern)
2. **NOWPayments IPN has no replay protection** documented
3. **D1 has no transactions** — atomic locks required for financial ops
4. **BYOK keys stored in whatsapp_templates** — encryption verification needed
5. **No rate limiting on admin routes** — tier/role gate only

## Migration Opportunities
1. **Strangler pattern**: new domain model alongside existing, migrate incrementally
2. **Agent protocol**: define interfaces first, wrap existing agents gradually
3. **Creative Memory**: new D1 tables, no schema migration needed
4. **IP Graph**: new tables, additive only
5. **Mission**: new table, additive

## What MUST NOT be Rewritten
1. Setup Wizard (BYOK onboarding — production critical)
2. Telegram Bot integration (customer-facing)
3. Payment Flow (NOWPayments IPN → tier activation)
4. Auth system (Better Auth integration)
5. D1 schema (existing tables — additive migrations only)
6. Deploy pipeline (CF-direct doctrine)
7. Layer import rules (enforced by ESLint)

## What Should Be Deprecated
1. Duplicate agent patterns → unify under agent protocol
2. Legacy auth checks in API routes → consolidate to middleware
3. Ad-hoc video abstractions → migrate to Content Graph

## What Should Become Reusable Platform Primitives
1. `AgentDefinition` / `AgentResult` contract (forest → land usage)
2. `SignalProvider` interface (forest → land usage)
3. `ProvenanceRecord` (append-only, cross-cutting)
4. `CreativeIdentity` (system-level context, all agents)
5. `Mission` lifecycle (top-level orchestration)
6. Provider abstraction (capability-based adapters)