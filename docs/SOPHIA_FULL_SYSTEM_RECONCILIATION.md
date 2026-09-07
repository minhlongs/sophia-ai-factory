# SOPHIA AI FACTORY — Full System Reconciliation

> **SUPREME COMMAND #4 — Complete Audit**
> **Date:** 2026-09-07 | **HEAD:** 47fc01546 | **Pipeline:** /orchestrate
> **Classification:** READ-ONLY — no source changes, no deployment, no commits
> **Method:** 11 recon reports + independent verification of critical code paths

---

## S1 — Repository Topology

### Canonical Application

Single Next.js 16 App Router application at `apps/sophia-ai-factory/`, deployed to Cloudflare Workers via OpenNext (CF-direct doctrine). No monorepo, no packages, no services.

### Source File Counts

| Layer | TS/TSX Files | Test Files | Non-Test Files | Subdirs |
|-------|-------------|-----------|----------------|---------|
| seed | 574 | 112 | 462 | 86 |
| tree | 707 | 186 | 521 | 128 |
| forest | 714 | 152 | 562 | 134 |
| land | 756 | 215 | 541 | 139 |

**Total:** ~2,751 TS/TSX files across 4 layers.

### Non-Layer Directories

| Directory | Files | Status |
|-----------|-------|--------|
| `src/app/` | ~500+ | CORE — App Router pages, API routes, layouts |
| `src/components/` | 120 | LEGACY — crosses layer boundaries freely |
| `src/middleware/` | 11 | CORE — Auth, API pipeline, MFA, CSP |
| `src/core/mode/` | 2 | DEAD-UNUSED |
| `src/oracle/` | 2 | DEAD-UNUSED |
| `src/workers/` | 2 | DEAD-UNUSED |
| `src/data/`, `src/db/` | 0 | DEAD-UNUSED (empty) |
| `src/sdk/` | 4 | OPTIONAL — CLI SDK examples |

### Infrastructure

| System | Binding | Status |
|--------|---------|--------|
| D1 `sophia-raas-db` | `DB` | CORE — 267 migrations, ~242 tables |
| D1 `sophia-tag-cache` | `NEXT_TAG_CACHE_D1` | CORE — OpenNext ISR tag cache |
| D1 `sophia-experiment` | `EXPERIMENT_DB` | CORE — A/B experiments |
| R2 `sophia-videos` | `VIDEO_BUCKET` | CORE — Video assets |
| KV `EXPERIMENT_KV` | KV | CORE — Feature flags |
| KV `KV_KV` | KV | CORE — Quota/session/rate-limit caches |
| Upstash Redis | env vars | 5 client implementations (debt) |
| Inngest Cloud | `seed/inngest/client.ts` | CORE — Job orchestration |
| NOWPayments | external | CORE — Primary payment provider |
| PayOS | external | CORE — Vietnam domestic backup |

### Payment/Billing Systems

| Provider | Files | Role | Status |
|----------|-------|------|--------|
| NOWPayments | 129 | Primary payment (IPN webhooks, crypto) | CORE |
| PayOS | 23 | Vietnam domestic backup | CORE |
| Stripe | 46 | Connect (payouts only) | CORE |
| ClickBank | 52 | Affiliate network | CORE |
| Polar.sh | 7 | BANNED per doctrine | DEAD |

### Communication Systems

| System | Files | Role |
|--------|-------|------|
| Telegram (telegraf) | 168 | Bot @Sophia_Bbot — primary customer interface |
| Email (Resend) | multiple | Bilingual notifications |

---

## S2 — Architecture: Four-Layer Model Verification

### Layer Responsibilities

| Layer | Responsibility | Key Entrypoints |
|-------|---------------|-----------------|
| **seed** | Types, config, auth base, DB client, security primitives, logger, i18n, AI provider interfaces | `getCurrentUser()` (359 imports), `createServerClient()` (723 imports), `TIER_CONFIGS` (32 imports) |
| **tree** | Domain-reusable: BYOK store, handover, audit, telegram handlers, agent protocol, AI provider registry | `resolve-user-api-key.ts`, gateway/smart-resume, agents, agent-protocol |
| **forest** | Inngest job orchestration, quota enforcement, analytics, publishing pipelines, cron | 60+ Inngest functions, cron jobs, quota-enforcer, middleware |
| **land** | Business workflows: billing, payments, payouts, video generation, publishing, affiliates | billing/, video/, payouts/, affiliates/, checkout/ |

### Import Direction Rules

```
seed -> tree -> forest -> land (top-down)
forest -> land (orchestration exception, one-way only)
```

### Boundary Violations

**PRODUCTION CODE — 1 violation:**
- `src/land/openclaw-telegram/openclaw-bridge-tools.ts:9` imports `@/forest/publishing/schedule-publish` — land->forest violation (MEDIUM severity)

**TEST-ONLY — 10 violations (acceptable):**
- 7 seed->tree/forest/land violations in test files (integration tests)
- 3 tree->land violations in test files

### Duplicate Abstractions (CRITICAL)

**AI Providers — seed/ai/ vs forest/ai/:**
- 6 modules exist in both locations
- `script-prompt-builders.ts` — IDENTICAL (zero diff)
- `anthropic-adapter.ts` — independent implementations (forest adds BYOK/usage metering)
- `elevenlabs-api-client.ts` — different error handling paths
- `video-generator.ts` — forest has VideoStatus interface

**Analytics — forest/ vs land/:**
- `ltv-calculator.ts` — IDENTICAL except import path
- `queries/revenue-nowpayments.ts` — byte-for-byte IDENTICAL

**Components outside layer model:**
- `src/components/` (120 files) imports from land and forest freely — no defined layer
- `src/forest/components/analytics/` imports from `@/land/analytics/`

---

## S3 — User Journey Trace

### Complete Lifecycle: 15 Transitions

| # | Transition | Status | Evidence |
|---|-----------|--------|----------|
| 1 | USER -> AUTH | IMPLEMENTED | `better-auth-server.ts:32`, D1 session, middleware pipeline |
| 2 | AUTH -> ONBOARDING | IMPLEMENTED (soft gate) | 6-step wizard; middleware does NOT enforce `onboarding_completed_at` |
| 3 | ONBOARDING -> MISSION | IMPLEMENTED | `actions.ts:109`, Zod + auth + workspace check |
| 4 | MISSION -> BRIEF | IMPLEMENTED (implicit) | No separate artifact; mission fields serve as brief |
| 5 | MISSION -> AI REASONING | IMPLEMENTED | `agent-mission-executor.ts`, BYOK providers, budget guard |
| 6 | AI REASONING -> STORYBOARD | PARTIAL | Type contract exists; no standalone DB persistence |
| 7 | STORYBOARD -> IMAGE | PARTIAL | V1 InlineMockImageProvider only |
| 8 | IMAGE -> VIDEO | IMPLEMENTED | `video-generate.ts:50`, 11-step Inngest pipeline, FSM |
| 9 | VIDEO -> AUDIO | IMPLEMENTED | ElevenLabs BYOK + Fish Speech fallback |
| 10 | VIDEO -> RENDER | IMPLEMENTED | Cloudconvert mux or brand-kit composite -> R2 |
| 11 | RENDER -> QA | IMPLEMENTED | `agent-approval-gate.ts`, human review, timeout cron |
| 12 | QA -> RESULT | IMPLEMENTED | `video-access-control.ts`, dashboard pages |
| 13 | RESULT -> BILLING | IMPLEMENTED | NOWPayments IPN -> atomic lock -> subscription activation |
| 14 | BILLING -> DELIVERY | IMPLEMENTED | Multi-provider adapters, OAuth token refresh |
| 15 | DELIVERY -> USER | IMPLEMENTED | Dashboard, Telegram, email, onboarding video |

**Summary:** 12/15 IMPLEMENTED, 2/15 PARTIAL (storyboard persistence, standalone image generation), 0/15 NOT IMPLEMENTED.

### Critical Gap: Onboarding Gate Not Enforced

The middleware does NOT check `onboarding_completed_at` or the `wizard_done_` cookie. Dashboard access is granted once authenticated + MFA passes. This is a soft gate only.

---

## S4 — AI Provider Layer

### Provider Matrix

| Provider | Chat | Image | Video | Audio | Vision | Cost | Circuit Breaker | Production |
|----------|------|-------|-------|-------|--------|------|----------------|------------|
| OpenRouter (text) | YES | NO | NO | NO | Model-dep | Metered | CB + 3-fail cooldown | PROD |
| OpenRouter (image) | NO | YES | NO | NO | NO | Metered | CB | PROD |
| Claude-Fable | YES | NO | NO | NO | YES | Metered | Health tracker | PROD |
| ElevenLabs | NO | NO | NO | YES (TTS) | NO | Metered | CB + health | PROD |
| Wan 2.1 | NO | NO | YES | NO | NO | Metered | CB | PROD |
| HeyGen | NO | NO | YES | NO | NO | Metered | KV-backed CB | PROD |
| D-ID | NO | NO | YES | NO | NO | Metered | CB | PROD |
| Replicate | NO | NO | YES | NO | NO | Metered | CB | PROD fallback |
| MuAPI | NO | YES | YES | YES | NO | Metered | CB | PROD |
| Apollo | NO | NO | NO | NO | NO | Metered | **NO CB** | PROD (gap) |
| Hunter (intelligence) | NO | NO | NO | NO | NO | Metered | **NO CB** | PROD (gap) |
| Hermes | YES | YES | NO | NO | Input-only | Unmetered | CB | NOT READY |
| MockImage | NO | YES | NO | NO | NO | Internal | None | TEST |
| Mock | YES | NO | NO | NO | NO | Internal | None | TEST |

**Total:** 15 distinct providers, 4 full `Provider` interface implementors, 9 non-Provider HTTP clients, 2 test-only.

---

## S5 — Hermes Reconciliation

### Certification Status vs Code Reality

| Dimension | Certification | Code Reality | Enforced? |
|-----------|---------------|-------------|-----------|
| Security | BLOCKED | No security gate on instantiation | **NO** |
| Health | BLOCKED | Default base URL `127.0.0.1:8100` — incompatible with CF Workers | **Confirmed broken** |
| Capability Truth | PASS | `imageGenerate: false` declared, but chat() calls `/v1/images/generations` | **Contradiction** |
| Reliability | PASS | 120s timeout + CB + failure classification | YES |
| Circuit Breaker | PASS | 4-state D1-backed CB | YES |
| Economics | PASS | `unmetered` correctly implemented, router ranks at `cheapestMeteredCost + EPSILON` | YES |
| Canary | BLOCKED | No canary mechanism | **NO** |
| Production | NOT READY | No readiness gate — `createProvider({id:'hermes'})` succeeds unconditionally | **NO** |

### Key Findings

1. **Hermes is NEVER selected by primary LLM routing** — `llm-router.ts` only routes to `openrouter` or `Claude-Fable`
2. **Hermes is excluded from default fallback** — `['openrouter', 'Claude-Fable', 'elevenlabs']` does not include hermes
3. **Hermes CAN become SPOF** if user has ONLY Hermes BYOK key — no guard prevents this
4. **Capability contradiction:** adapter module is named "image generation adapter", default chat() calls `/v1/images/generations`, but capabilities declare `imageGenerate: false`
5. **Vision capability disagrees:** `isHermesSupported('vision')` returns false, but `getCapabilities().vision` returns true
6. **No certification enforcement anywhere** — no `isHermesCertified()`, no feature flag, no license check

---

## S6 — Creative Cell V1 Audit

### Abstraction Assessment

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Abstraction placement | CORRECT | `ImageGenerationProvider` at seed layer |
| Event contract | CORRECT | 3 events: `creative/image.{requested,completed,failed}` |
| Idempotency | HANDLED | `jobId` lookup before generation |
| Retry behavior | CORRECT | Dual-layer (Inngest + internal) — redundant but safe |
| Timeout behavior | PARTIAL | Defined in type, not enforced at handler level |
| Failure persistence | CORRECT | D1 + typed event + FailureKind classification |
| Result gate | AUTHORITATIVE | 5-layer validation before persist |
| Multi-provider support | PARTIAL | Interface ready, factory/registry missing |
| image.edit | ABSENT (intentional) | No handler, no event, no type |

### Minimum Change for Real Provider

Implement `ImageGenerationProvider` for one service (e.g., Replicate flux-schnell): 1 new file + 1 file modified (~30 lines). Or refactor `OpenRouterImageAdapter` to implement `ImageGenerationProvider` instead of `Provider`: 2 files modified (~50 lines).

---

## S7 — Event / Orchestration Topology

### Event System

| Metric | Count |
|--------|-------|
| Canonical event keys | 43 (typed in `event-types.ts`) |
| Inngest functions served | 40 (registered in `route.ts`) |
| Inngest cron jobs | 22 |
| HTTP cron routes | ~43 (Cloudflare Workers) |
| Webhook endpoints | 14 |

### Pipeline Chains

**Video Pipeline (6-step chain):**
```
video.requested -> scripting -> video.script.ready
    -> tts -> video.tts.ready
    -> visual -> video.visual.ready
    -> compose -> video.composed
    -> upload -> video.uploaded
    -> publish -> video.published
```

**Creative Image Pipeline (1-step):**
```
creative/image.requested -> creative-image-generate
    -> creative/image.completed | creative/image.failed
```

**Agent Mission Loop:**
```
agent.mission.started -> executor -> mission.completed
    -> provenance-bridge
    approval.requested -> gate -> approval.resolved -> handler
```

### Duplications

| Pattern | Locations | Issue |
|---------|-----------|-------|
| DLQ retry | `dlq-reaper.ts` (Inngest) + `cron/dlq-retry/route.ts` (HTTP) | Same logic, two implementations |
| Video orchestration | `video-generate.ts` + `generate-campaign.ts` + `campaign-orchestrator.ts` | Three orchestrators |
| Cron systems | Inngest-native (22) + HTTP cron routes (43) | Two trigger mechanisms |

### Hidden Sync Dependencies

`generateImageAction` at `app/actions/image-generate-action.ts:82` makes synchronous MuAPI HTTP call in Server Action — violates Inngest pattern.

---

## S8 — State / Data Ownership

### Source-of-Truth Map

| Domain | Source of Truth | Location |
|--------|----------------|----------|
| User identity | Better Auth `user` table | `migrations/0003` |
| User tier | `subscriptions.plan` + `organizations.plan` | Multiple tables |
| MCU credits | `user_credits` (top-up) + `user_mcu_balance` (monthly) | **TWO PARALLEL LEDGERS** |
| Billing events | `payment_events` (atomic lock) | `overage-topup.ts` |
| Video jobs | `video_jobs` table | `migrations/0031` |
| Video binary | R2 `VIDEO_BUCKET` | `wrangler.toml` |
| Job queue | Inngest Cloud | `seed/inngest/client.ts` |

### Critical: Dual MCU Ledger

`user_credits` table (overage-topup.ts) and `user_mcu_balance` table (credits-repo.ts) track MCU balance independently. Reconciliation exists at `tree/usage-metering/usage-reconciliation.ts` but the dual D1 ledger is technical debt.

### Migration Debt

- 233 migration files, ~242 tables
- 6 duplicate-prefix groups (e.g., three files with prefix `0004`)
- **CONFLICT:** `0203_payment_events_dropped.sql` says dropped, but code actively uses `payment_events` table

### Redis Debt

5 separate client implementations: `land/redis.ts`, `tree/clients/upstash-redis-client.ts`, `seed/cache/redis.ts`, `seed/utils/redis-client.ts`, `seed/redis.ts`. No canonical client.

### Race Condition Mitigations

- Double payment: `INSERT ... ON CONFLICT DO NOTHING` (atomic lock)
- Double refund: Same pattern
- Tier update: NOT atomic (two sequential UPDATEs in refund-processor)
- Stale lock: 5-min recovery

---

## S9 — Billing / Economics

### Margin Analysis

| Tier | Monthly Price | Marginal Cost | Gross Margin |
|------|--------------|---------------|-------------|
| BASIC | $19.90 | ~$0.40-2.00 | 90-98% |
| PREMIUM | $39.90 | ~$0.40-2.00 | 95-99% |
| ENTERPRISE | $79.90 | ~$0.40-2.00 | 97-99% |

### Billing Flow

```
NOWPayments IPN -> HMAC-SHA512 verify -> atomic lock (payment_events)
    -> dispatch by status (finished/refunded/failed/expired)
    -> subscription activation (d1.batch)
    -> post-activation workflow (audit, promo, onboarding video, handover, email)
```

### Gaps

- **Overage billing OFF by default** — overage-topup exists but requires explicit opt-in
- **`payment_events` -> `performance_events` bridge is ZERO** — no automated link between payment events and revenue tracking
- **Static NOWPayments invoice IDs** — `NOWPAYMENTS_INVOICE_IDS` in tier-configs means price changes require code changes
- **`dynamic-pricing.ts` exists but is not wired** to `tier-change-provisioner.ts`

---

## S10 — Security / Trust Boundaries

### Security Architecture

| Layer | Mechanism | Status |
|-------|-----------|--------|
| CSRF | Timing-safe token comparison in middleware | ACTIVE |
| MFA | Fail-closed challenge gate | ACTIVE |
| Auth | Better Auth + D1 sessions | ACTIVE |
| BYOK encryption | AES-GCM-256 for API keys | ACTIVE |
| Webhook verification | HMAC-SHA512 (NOWPayments) | ACTIVE |
| SSRF guard | Triple check (IP, localhost, internal) | ACTIVE |
| PII scrubbing | Dual-layer (middleware + logger) | ACTIVE |
| Error sanitization | Production error stripping | ACTIVE |
| CSP | Nonce-based Content Security Policy | ACTIVE |
| CORS | Allowlist-based | ACTIVE |
| Cron auth | Triple auth (canary + rate limit + signature) | ACTIVE |

### Security Findings

| Severity | Count | Details |
|----------|-------|---------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 4 | (1) `console.error` in middleware.ts:172 leaks stack trace. (2) `console.debug` in wae-client.ts:55,73 bypasses PII scrubbing. (3) Hermes certification not enforced — `createProvider({id:'hermes'})` succeeds unconditionally. (4) Hermes adapter default base URL `127.0.0.1:8100` incompatible with CF Workers. |
| LOW | 2 | (1) Zero hardcoded secrets (positive). (2) Zero `: any` in production code (positive). |
| INFO | 13 | All listed mechanisms above are correctly implemented. |

### Protected Flows Status

| Flow | Status | Evidence |
|------|--------|----------|
| Setup Wizard | FUNCTIONAL | 6-step wizard, AES-GCM key storage, verify endpoint |
| Telegram Bot | FUNCTIONAL | dispatch-with-retry-hints, user-notifier |
| Payment Flow | FUNCTIONAL | NOWPayments IPN -> atomic lock -> subscription activation |

---

## S11 — Production Deployment Truth

### Deployment Model

- **CF-direct doctrine:** `npm run deploy:full` from `apps/sophia-ai-factory/`
- **SHA verification:** `deploy-with-sha.sh` checks git SHA matches live
- **No CI/CD:** GitHub Actions disabled by design
- **Migration apply:** `scripts/apply-migrations.sh` for D1

### Deployment Verification

```
1. git push origin main
2. cd apps/sophia-ai-factory && npm run deploy:full
3. LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
4. LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | ...)
5. Verify LOCAL_SHA == LIVE_SHA
```

---

## S12 — Testing / Quality Baseline

### Test Pyramid

| Layer | Test Files | Production Files | Density |
|-------|-----------|-----------------|---------|
| land | 215 | ~541 | 0.40 |
| tree | 186 | ~521 | 0.36 |
| forest | 152 | ~562 | 0.27 |
| seed | 112 | ~462 | 0.24 |
| **Total unit** | **853** | **~2,086** | **0.41** |

Plus: ~42 integration, 6 contract, 36 E2E (Playwright), 7 security tests.

### Baseline Problem

The only machine-readable test artifact (`test-results.json`) is **2 months stale** (Jul 5): 5994 total, 5915 passed, 45 failed. Documentation claims 8546-8757 tests (Aug 25-29) but these are UNVERIFIED — no structured artifact supports them.

### False Confidence Risks

1. **Zero HTTP mocking** (msw/noRealFetch) — 500 files use `vi.mock` at module level; verifies mock behavior, not real API contracts
2. **No DB integration testing** — D1 unavailable in test env; 1 `skipIf(DATABASE_URL)` file
3. **Dashboard coverage threshold at 5%** — effectively no guard
4. **Only 2 middleware test files** for the entire auth/CSRF/CORS/MFA/CSP stack
5. **45/45 Jul 5 failures were mock-related** — tests pass while mocks are wrong

### Quality Verdict

**MEDIUM-LOW confidence.** Test volume is high (853 files) but mock-heavy, stale baseline, missing integration/E2E proof.

---

## S13 — Sophia as AI Factory Classification

### Verdict: F. Hybrid

Sophia is an **AI video SaaS built on a workflow-engine substrate with factory-OS ambitions not yet realized.**

Three overlapping layers:
1. **AI Video SaaS** — Customer-facing video generation + publishing platform
2. **AI Workflow Engine** — All long-running jobs route through Inngest with multi-step pipelines
3. **Emerging Factory-OS Skeleton** — `land/factory/` exists (351 LOC total) but is thin

### Factory Cell Status

| Cell | Grade | Evidence |
|------|-------|----------|
| Intelligence | PARTIAL | `land/intelligence/` + `forest/ai/cost-aware-router.ts`; no unified "decide what to make next" |
| Creative | PARTIAL | `land/creative-mission/actions.ts` + creative-memory + creative-economy; analytics only, not generative |
| Image | MISSING | Only `MockImageGenerationProvider` + `OpenRouterImageAdapter` (not wired); `hermes-capabilities.ts` declares `imageGenerate: false` |
| Video | IMPLEMENTED | 8-state FSM, 9-step Inngest pipeline, 4 render providers (HeyGen/FaceFusion/Wav2Lip/Mock) |
| Audio | IMPLEMENTED | ElevenLabs TTS, Fish Speech, voice cloning |
| Render | PARTIAL | HeyGen BYOK + Cloudconvert mux + MoviePy Fly service; no native renderer |
| QA | PARTIAL | Pre-render analysis (scene-detector, highlight-scorer); NO post-generation quality gate |
| Billing | IMPLEMENTED | Full metering + tier + refund + dunning + overage |
| Delivery | IMPLEMENTED | 16 platform adapters, fulfillment, affiliate, payout |

---

## S14 — Bottleneck Analysis

### Top 10 Bottlenecks (Ranked by IMPACT x RISK x COST)

| Rank | Score | Bottleneck | Impact | Risk |
|------|-------|-----------|--------|------|
| 1 | 9/10 | No production image-generation capability (Image Cell MISSING) | Thumbnails, scene stills, brand assets require images | BYOK workaround exists |
| 2 | 8/10 | Single Inngest client — all workflows on one orchestration spine | One misconfiguration breaks all jobs | No blast-radius containment |
| 3 | 8/10 | Synchronous DB client in async Inngest steps | D1 sync client + no transaction isolation | Lost updates under load |
| 4 | 7/10 | Hermes adapter — local SD server with no edge image gen, violates no-tech doctrine | Operator-side infra required | Credential required |
| 5 | 7/10 | Tier/pricing disconnect — static invoice IDs, no per-seat metering | Price changes require code changes | No usage-based overage |
| 6 | 7/10 | No unified factory scheduler — cells not orchestrated | "Factory" is metaphor, not system | Current demand manual |
| 7 | 6/10 | Publishing provider coverage — mock mode default for most platforms | 16 adapters exist but most need BYOK | Intentional (no-tech) |
| 8 | 6/10 | No post-generation QA gate — videos ship without quality validation | Bad videos damage customer brands | No automated scoring |
| 9 | 5/10 | Event orchestration duplication — Inngest vs direct-call patterns | Three orchestration patterns | Debugging requires knowing which path |
| 10 | 5/10 | Test gaps — mock providers in production code paths | Mock path tested, production path not | Regression would reach prod undetected |

---

## S15 — DO NOT BUILD List

Items explicitly identified as out-of-scope or harmful:

1. **DO NOT add Hermes to production routing** — Security BLOCKED, Health BLOCKED, Production NOT READY
2. **DO NOT add Polar.sh** — Rejected this product category during integration review
3. **DO NOT add PayPal** — Banned per Sophia billing doctrine
4. **DO NOT create `src/lib/`** — Deleted by design; all primitives in seed/tree/forest/land
5. **DO NOT add GitHub Actions CI/CD** — CF-direct doctrine disables CI by design
6. **DO NOT wire Hermes as sole provider** — SPOF risk with no fallback
7. **DO NOT add image.edit** — Intentionally absent; type system allows future addition
8. **DO NOT add operator-side cron registrations** — No-tech doctrine: operator manages PLATFORM ONLY
9. **DO NOT merge tree/ai-providers with seed/ai** — Deprecated marker registry says `removableAfter: 2026-09-06` (7 files still exist)

---

## S16 — Target Architecture

### Current vs Target

| Dimension | Current | Target |
|-----------|---------|--------|
| Image generation | Mock-only | Real provider (OpenRouter image or Replicate) |
| Hermes | Unconditionally instantiable | Certification-gated |
| Factory scheduler | 351 LOC skeleton | Cell-level production scheduler |
| Test baseline | 2-month stale artifact | Fresh, CI-persisted structured artifact |
| Duplicate modules | 6+ between seed/ai and forest/ai | Single canonical per module |
| Redis clients | 5 implementations | 1 canonical client |
| `src/components/` | Crosses layers freely | Folded into land or given import rules |
| Overage billing | OFF by default | Wired to tier-change-provisioner |

### 3-Horizon Roadmap

**Horizon 1 (Immediate — blocks "AI Factory" identity):**
- Wire real image generation provider into Creative Cell
- Add Hermes certification gate to provider-factory
- Remove or mark 6+ seed/forest AI duplicates

**Horizon 2 (Near-term — hardening):**
- Fresh test baseline artifact (run + persist)
- Consolidate Redis clients
- Move `src/components/` into defined layer
- Fix land->forest violation in openclaw-bridge-tools.ts

**Horizon 3 (Medium-term — factory evolution):**
- Factory scheduler for cell orchestration
- Post-generation QA gate
- Dynamic pricing wired to provisioning
- Payment-events to performance-events bridge

---

## S17 — Priority Roadmap

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Wire real image provider (OpenRouter image adapter -> ImageGenerationProvider) | 1 file + 30 lines | Unblocks Image Cell |
| P0 | Add Hermes certification gate in provider-factory.ts | 1 file + 15 lines | Prevents accidental production use |
| P1 | Run fresh test suite + persist structured artifact | 30 min | Restores baseline confidence |
| P1 | Fix land->forest violation (openclaw-bridge-tools.ts) | 1 file + invert | Restores architecture purity |
| P1 | Remove expired tree/ai-providers (removableAfter: 2026-09-06) | 7 files deleted | Removes confusion |
| P2 | Consolidate seed/ai and forest/ai duplicate modules | ~6 files | Reduces maintenance burden |
| P2 | Consolidate Redis clients to canonical | ~5 files | Eliminates race risk |
| P2 | Wire dynamic-pricing to tier-change-provisioner | 2 files | Enables usage-based pricing |
| P3 | Add post-generation QA gate | New subsystem | Prevents bad video publishing |
| P3 | Build factory scheduler skeleton | New subsystem | Enables cell orchestration |

---

## S18 — CEO Verdict

### System Health: GREEN (with known debt)

Sophia AI Factory is a **functioning production system** with 12/15 user journey transitions fully implemented, 3 payment providers operational, 16 publishing adapters, and an active Inngest orchestration layer serving 40 functions + 22 cron jobs.

### Architecture Integrity: 7/10

The four-layer model (seed->tree->forest->land) is Claude-Fable in production code. One land->forest violation. Test-only boundary crossings are acceptable. Duplicate abstractions between seed/ai and forest/ai are the primary architectural debt.

### Production Readiness: 8/10

All three protected flows (Setup Wizard, Telegram Bot, Payment) are functional. Security posture is strong (zero critical/high findings, all 13 defensive mechanisms active). The main risk is the stale test baseline (2 months) and mock-heavy test suite.

### AI Factory Readiness: 4/10

The "AI Factory" identity is aspirational. The Video Cell and Audio Cell are genuinely implemented. But the Image Cell is missing, the factory scheduler is a 351-LOC skeleton, and no cell-level orchestration exists. The system is better described as "AI Video SaaS with workflow-engine substrate."

### Next Command

**SUPREME COMMAND #5:** Enforce Hermes Certification Gate + Wire Production Image Cell.

Rationale: Bottlenecks #1 and #2 are the highest-impact items. Hermes must have a runtime certification gate (preventing instantiation when Security=BLOCKED), AND the image generation cell must be wired to a real provider. These unblock the "AI Factory" identity. Everything else is incremental.

---

*Audit date: 2026-09-07 | HEAD: 47fc01546 | Reports: plans/reports/recon-{02..12} + recon-01 (agent notification)*
*Artifact: docs/SOPHIA_FULL_SYSTEM_RECONCILIATION.md (S1-S18)*
*Companion: plans/reports/sophia-full-system-reconciliation.md (executive summary)*
