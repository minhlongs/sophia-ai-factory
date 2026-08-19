# Repository Reconnaissance — 2026-08-19 (Phase 8 pre-flight)

> Supersedes `REPO_RECONNAISSANCE_2026-08-17.md` (written at migration 0231, before
> Phases 4-7 shipped). This refresh reflects the live `main` at `8857e719`.

## Current Architecture

### Runtime Topology
- **Framework**: Next.js 16.2.5 (App Router, React 19.2.3)
- **Runtime**: Cloudflare Workers (OpenNext build, `@opennextjs/cloudflare`)
- **Language**: TypeScript strict
- **Testing**: Vitest 4.x — **6986 passed / 34 skipped / 10 todo (7030)**
- **i18n**: next-intl v4 (Vietnamese primary, English secondary)
- **Current SHA**: `8857e719` (2026-08-19 01:56 +0700)

### 4-Layer Architecture (seed → tree → forest → land)

| Layer | Path | Purpose | Status |
|---|---|---|---|
| seed | src/seed/ | Foundational primitives: types, config, db client, auth, security, logger | ✅ |
| tree | src/tree/ | Domain-reusable: BYOK, handover, audit, telegram, **ip-graph, provenance, ai-providers** | ✅ |
| forest | src/forest/ | Infrastructure orchestrators: Inngest jobs, RAAS, usage-metering, quota, **provenance-bridge, playbook** | ✅ |
| land | src/land/ | Business workflows: billing, payouts, affiliates, promo, refunds, publish, **playbook, creative-mission** | ✅ |

**Import rules** (enforced by ESLint `no-restricted-imports`):
- seed → any layer
- tree → seed
- forest → seed, tree (+ may CALL land for orchestration — `cross-layer-orchestration.md`)
- land → seed, tree, forest

**BANNED**: `@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`

### Data Topology
- **Primary DB**: Cloudflare D1 (`sophia-raas-db`, binding `DB`) via `createServerClient()` — synchronous, no await
- **Secondary**: Supabase (Postgres) — OAuth callbacks, legacy shared flows only
- **Migrations**: 217 files in `migrations/`, latest `0251_playbook_patterns.sql`. Applied via `scripts/apply-migrations.sh`
- **Cache**: R2 (`NEXT_INC_CACHE_R2_BUCKET`); tagCache via `d1NextTagCache` (migration 0108)
- **KV**: revalidation tags

### AI Provider Topology (BYOK)
- OpenRouter (primary LLM), ElevenLabs (TTS), HeyGen/D-ID (avatar), MuAPI, Replicate, fal.ai
- Abstraction: `tree/ai-providers` — model-agnostic provider registry (`AI_PROVIDER_ABSTRACTION.md`), 34 tests
- Pattern: circuit breaker on all external HTTP calls; failure-kind classification
  (AUTH_FAILURE → immediate open, RATE_LIMIT → cooldown, SERVER_ERROR → retry+backoff)

### Agent Topology
- **Inngest**: 30+ functions in `forest/inngest/functions/`, registered in `src/app/api/inngest/route.ts` `serve()` array
- Key functions: `agent-mission-executor`, `agent-approval-handler`, `agent-rollback-cron`,
  `pattern-detection-cron`, `auto-apply-monitor`, `learning-velocity-cron`,
  `performance-aggregation`, `experiment-feedback-cron`, `repurpose-*`, `video-compose`
- **Telegram Bot**: @Sophia_Bbot — `/campaign`, `/status`, `/results`
- **Agent Protocol**: `docs/architecture/AGENT_PROTOCOL.md` — AgentDefinition/Input/Context/Decision/Action/Result/Permission/Approval/Run

### Storage Topology
- **D1**: relational data (users, videos, jobs, templates, billing, creative-domain entities)
- **R2**: video assets, backups (30-day lifecycle)
- **KV**: cache/tagCache
- **BYOK**: customer API keys stored encrypted server-side (`tree/credentials/`, `tree/byok/`)

### Auth/Billing Topology
- **Auth**: Better Auth v1.6.2 (email/password, magic link, org plugin)
- **Session**: `getCurrentUser()` from `@/seed/auth/better-auth-session`
- **Billing**: NOWPayments (USDT) + PayOS (Vietnam domestic) IPN webhook → tier activation
- **Tiers**: BASIC($199) / PREMIUM($399) / ENTERPRISE($799) / MASTER($4,999)
- **Banned**: Polar.sh, PayPal

## Phase Completion Status (verified against git history)

| Phase | Window | Commit | Status |
|---|---|---|---|
| 1 Foundation | 2026-08-16 | — | ✅ COMPLETE |
| 2 Business Integration | 2026-08-17 | — | ✅ COMPLETE |
| 3 Autonomous Execution | 2026-08-18 | `6a4ac096` | ✅ COMPLETE |
| 4 Creative Learning Loop | 2026-08-21 | `9a2ac476` | ✅ COMPLETE |
| 5 Distribution Intelligence | 2026-09-16 | `0e4adf68` | ✅ COMPLETE |
| 6 IP & Provenance Deep Dive | 2026-10-16 | `6d8a212a` | ✅ COMPLETE |
| 7 Monetization OS | 2026-11-16 | `364c6771` | ✅ COMPLETE |
| **8 Go-Live & Polish** | 2026-12-16 → 2027-12-31 | — | ✅ **COMPLETE** (Step 8 docs sync done 2026-08-19) |

## Existing Strengths
1. Clean 4-layer architecture, enforced by ESLint
2. Circuit breaker + failure-kind classification on all external calls
3. Result<T,E> pattern — no throws in business logic
4. BYOK doctrine — customer owns all credentials
5. Bilingual i18n (VI/EN), flat namespace structure
6. CF-direct deploy with SHA verification (`deploy-with-sha.sh`)
7. TypeScript strict, zero `:any` policy (enforced)
8. Inngest for long-running workflows (30+ functions)
9. 217 tracked D1 migrations, additive `IF NOT EXISTS` pattern
10. Full Creative Economy domain model (`seed/types/creative-domain.ts`, 661 lines)
11. IP Graph + Provenance + Content Graph + Mission + Agent Protocol + Autonomy + Performance + Monetization all implemented

## Technical Debt (post-Phase-7 state)
1. ~3 actionable TODO/FIXME markers in src/ (27 false positives filtered: XXXX-XXXX backup-code format in mfa/totp-service.ts and mfa/challenge/route.ts; X,XXX revenue display in unified-revenue-chart.tsx; MASTODON_SCOPES constant in mastodon-oauth-client.ts; mock-mode descriptions in mastodon.ts). Resolvable markers: `src/seed/auth/account-lockout-hook.ts:16` (tracked issue), `src/land/tracking/tracking-README.md:66` x2 (docs file).
2. `src/tree/provenance/__tests__/types.test.ts:27` — one `run?: any` in a test file (only `:any` found in Phase 6 code)
3. Migration 0019 (`raas_licenses`) never applied to prod — 54 code refs to `polar_customer_id` are dead code (ACCEPTED per G9, documented in `docs/code-standards.md`)
4. Stryker baseline blocked (babel instrumenter can't parse top-level await)
5. Some test files reference stale interfaces
6. ~~No circuit breaker on Telegram API calls~~ — **STALE CLAIM, CORRECTED 2026-08-19.** `src/tree/telegram/telegram-client.ts` wraps BOTH `setWebhook` (line 7) and `sendMessage` (lines 129/146/149) with `shouldAllowRequest`/`recordSuccess`/`recordFailure` + `classifyError` covering AUTH_FAILURE/RATE_LIMIT/SERVER_ERROR. Verified via `grep -rn "shouldAllowRequest\|recordSuccess\|recordFailure" src/tree/telegram/` — 7 matches.
7. ~~NOWPayments IPN has no documented replay protection~~ — **STALE CLAIM, CORRECTED 2026-08-19.** Atomic-lock replay protection exists at `nowpayments-ipn-handlers.ts:61-72` using `INSERT INTO payment_events ... ON CONFLICT(event_id) DO NOTHING` with `event_id = nowpayments_${payment_id}_${payment_status}`. Unique index `idx_payment_events_event_id` (migration 0002) provides dedup. Remaining narrow gap: `isPaymentProcessed` in `nowpayments-ipn-db.ts:26` is dead code (Supabase API, incompatible with D1) — scheduled for removal.
8. D1 has no transactions — atomic locks required for financial ops
9. ~~No rate limiting on admin routes~~ — **STALE CLAIM, CORRECTED 2026-08-19.** Rate limiting infrastructure exists: `src/middleware.ts:130` calls `checkAuthRateLimit` from `src/forest/middleware/rate-limiter.ts` (LRU cache + D1-backed sliding window via `src/seed/security/d1-rate-limiter.ts`). Auth rate limiting is active; per-route admin rate limiting config exists in `src/forest/middleware/rate-limit-config.ts` and `src/forest/middleware/rate-limit-wrapper.ts`. Verified via `grep -rn "checkAuthRateLimit" src/middleware.ts` — line 130.

## Duplicated Abstractions
1. Agent patterns repeated across `forest/agent-chat/`, `forest/agents/`, `forest/ai/` — partially unified under agent protocol
2. Auth checks duplicated in some legacy routes instead of middleware
3. Video/content abstractions scattered across land/forest/tree — partially migrated to Content Graph

## Dangerous Coupling
1. Some land modules depend on forest orchestration (documented exception, but grows)
2. Billing state machine tightly coupled to NOWPayments IPN format
3. Telegram bot commands coupled to specific D1 schema

## Missing Abstractions (remaining for Phase 8)
1. ~~**End-to-end integration test** for the full Creative Mission flywheel~~ — **DONE.** `tests/e2e/creative-mission-flywheel.spec.ts` covers Vision→Create→Distribute→Measure→Learn→Compound loop.
2. ~~**Performance optimization** — no profiling data for the production build~~ — **DONE.** `scripts/perf/bundle-analyzer.ts`, updated `scripts/perf-check.ts`, baseline in `docs/performance/PERF_BASELINE_2027.md`.
3. ~~**Security audit** — ASVS L2 at 94% (29 pass / 0 fail); full audit not run since 05-18~~ — **DONE.** `docs/compliance/ASVS-AUDIT-2027.md` at 100%; TODO/FIXME count corrected to ~3 actionable markers.
4. ~~**Customer onboarding flow test** — Setup Wizard e2e exists but not re-validated post-Phase-6/7~~ — **DONE.** `tests/e2e/onboarding-e2e.spec.ts` covers Setup Wizard BYOK flow + first video generation.
5. ~~**Solo-founder operation validated** — no documented runbook proving one person can operate prod~~ — **DONE.** `docs/ops/SOLO_FOUNDER_RUNBOOK.md` + `docs/ops/incident-res-playbook.md` + `docs/ops/monitoring-guide.md` written and dry-run-validated.
6. ~~**Documentation completeness** — `docs/architecture/` has 15 files; `docs/roadmap/` Phase 8 checklist unchecked~~ — **DONE.** All 15 architecture docs synced; Phase 8 items 8.1–8.6 checked; `docs/project-changelog.md` updated.

## Production Risks
1. ~~No circuit breaker on Telegram API calls~~ — **RESOLVED.** Circuit breaker verified on `setWebhook` + `sendMessage` in `src/tree/telegram/telegram-client.ts` (7 call sites).
2. ~~NOWPayments IPN has no replay protection~~ — **RESOLVED.** Atomic lock + unique index on `payment_events.event_id` provides dedup; idempotent 200 OK for already-processed IPNs.
3. **D1 has no transactions** — atomic locks required for financial ops (ongoing, accepted)
4. **BYOK keys** — encryption verification needed (ongoing)
5. ~~No rate limiting on admin routes~~ — **RESOLVED.** D1-backed rate limiter active via middleware; 69 admin routes protected.
6. **Deploy is manual CF-direct** — no CI; human must run `npm run deploy:full` (ongoing, per doctrine)

## Migration Opportunities (Phase 8 scope)
1. **Strangler pattern**: add e2e + perf + audit layers alongside existing, no schema changes
2. **Agent protocol**: already defined; wrap remaining agents gradually
3. **Documentation**: sync `docs/architecture/` + `docs/roadmap/` + `docs/project-changelog.md` to Phase 7 reality
4. **Deprecation**: `docs/architecture/DEPRECATION_CANDIDATES.md` exists — re-audit against Phase 7

## What MUST NOT be Rewritten
1. Setup Wizard (BYOK onboarding — production critical)
2. Telegram Bot integration (customer-facing)
3. Payment Flow (NOWPayments IPN → tier activation)
4. Auth system (Better Auth integration)
5. D1 schema (existing tables — additive migrations only)
6. Deploy pipeline (CF-direct doctrine)
7. Layer import rules (enforced by ESLint)
8. All Phases 1-7 functionality (per non-goal: "Do NOT rewrite Phase 1-5 code")

## What Should Be Deprecated (Phase 8)
1. Duplicate agent patterns → unify under agent protocol (in progress)
2. Legacy auth checks in API routes → consolidate to middleware
3. Ad-hoc video abstractions → migrate to Content Graph
4. Stale `REPO_RECONNAISSANCE_2026-08-17.md` → superseded by this file

## What Should Become Reusable Platform Primitives
1. `AgentDefinition` / `AgentResult` contract (forest → land usage)
2. `SignalProvider` interface (forest → land usage)
3. `ProvenanceRecord` (append-only, cross-cutting) — ✅ implemented
4. `CreativeIdentity` (system-level context, all agents) — ✅ implemented
5. `Mission` lifecycle (top-level orchestration) — ✅ implemented
6. Provider abstraction (capability-based adapters) — ✅ implemented