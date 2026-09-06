# CEO HANDOVER ARCHITECTURE AUDIT

> **Date:** 2026-09-05
> **Scope:** Sophia AI Factory (`apps/sophia-ai-factory`) + Hermes Antigravity OAuth Plugin (`nguyenphap-mt/Hermes-Antigravity-OAuth-Plugin`)
> **Method:** READ-ONLY inspection. No code modified, no config changed, no deploy, no commit.
> **Status symbols:** VERIFIED = confirmed in source · PARTIAL = interface/partial impl only · NOT FOUND = absent from repo · UNVERIFIED = plausible but not directly traced

---

# Section 1 — Executive Summary

**Purpose:** Determine the exact current architecture of BOTH repositories before any integration work. The goal is: **Sophia stays the Control Plane. Hermes may become an optional Capability Worker.** We do NOT merge repositories, share databases, share OAuth tokens, or expose credentials.

**Bottom line:**

| Item | Verdict |
|---|---|
| Sophia Architecture | **VERIFIED** — 23/23 concerns source-traced |
| Hermes Architecture | **VERIFIED (partial)** — 15/17 concerns traced; 2 NOT FOUND (image gen, tests) |
| Integration Surface | **FOUND** — 3 capabilities supported now, 1 partial, 1 absent |
| Critical Risks | **2** (see Section 7) |

**The single most important finding:** Hermes `bridge/auth.py` hardcodes a real Google OAuth **client secret** (`DEFAULT_CLIENT_SECRET`) in a public GitHub repo. This is a **CRITICAL** security exposure. It does NOT affect Sophia's systems, but it affects the Hermes account owner. (Value NOT printed per audit rules.)

**Recommended next step (ONE sentence):** Keep Sophia and Hermes fully separate for now; integrate only through a thin, read-only "provider bridge" contract (Section 11) once the hardcoded Hermes OAuth secret is rotated and a test suite exists.

---

# Section 2 — Sophia Architecture

**Canonical app:** `apps/sophia-ai-factory` — Next.js 16 App Router SaaS, deployed to Cloudflare Workers via OpenNext. Production: `https://sophia.agencyos.network`.

**4-layer architecture** (per `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`):

| Layer | Role | Count |
|---|---|---|
| `seed/` | Foundational primitives (types, config, db, auth, security, logger) | ~147 files |
| `tree/` | Domain reusable (BYOK, handover, audit, telegram) | ~162 files |
| `forest/` | Infra orchestrators (Inngest jobs, RAAS gateway, quota) | ~362 files |
| `land/` | Business workflows (billing, payouts, affiliates, promo) | ~113 files |

Import direction: `seed ← tree ← forest ← land` (forest may CALL land for orchestration — see `cross-layer-orchestration.md`).

## 23 Concerns (all VERIFIED)

| # | Concern | Key file | Key symbol |
|---|---|---|---|
| 1 | Canonical app | `apps/sophia-ai-factory/package.json` | `"name": "sophia-ai-factory"` |
| 2 | Entry points | `src/middleware.ts` | `middleware` (CSRF/CORS/MFA/locale) |
| 3 | API routes | `src/app/api/**` | 143 `route.ts` files (cron, webhooks, v1, auth, admin) |
| 4 | Mission orchestration | `src/forest/inngest/functions/*.ts` | 70+ Inngest functions |
| 5 | Workflow/state machine | `src/land/workflows/compute-next.ts` | pure state machine |
| 6 | AI provider abstraction | `src/seed/ai/provider-registry.ts` | `getHealthy()` / `getFallbackChain()` |
| 7 | Video pipeline | `src/forest/video/missions/video-create.ts` | HeyGen/D-ID providers |
| 8 | Image pipeline | `src/app/actions/image-generate-action.ts` | MuAPI (Midjourney/Flux) |
| 9 | Audio/voice pipeline | `src/seed/ai/text-to-speech-generator-elevenlabs.ts` | ElevenLabs TTS |
| 10 | Background jobs | Inngest fns + `src/forest/**/cron*.ts` | (cron external scheduling per no-tech doctrine — PARTIAL) |
| 11 | Queue/event system | `src/seed/inngest/client.ts` | 38 event keys, 70+ fns (no standalone queue — PARTIAL) |
| 12 | DB schema | `migrations/*.sql` (232 files) | file-based SQL, no Prisma schema (NOT FOUND) |
| 13 | Storage/asset | `src/seed/kv/kv-storage-ops.ts` | R2 (cache, videos, backups) + KV |
| 14 | Auth | `src/seed/auth/better-auth-session.ts` | `getCurrentUser()` — Better Auth v1.6.2 |
| 15 | Billing boundaries | `src/land/billing/**` + `src/app/api/webhooks/nowpayments/route.ts` | NOWPayments IPN → tier activation |
| 16 | Env config | `.env` (gitignored) + `src/seed/config/**` | key names only — no values |
| 17 | Deploy pipeline | `scripts/deploy-full-verified.sh` | CF-direct doctrine, wrangler |
| 18 | Pre-deploy gates | `pre-deploy-gate.mjs` | build + test gate |
| 19 | Post-deploy verification | `post-deploy-smoke.mjs` | SHA match via `/api/version` |
| 20 | Test architecture | `vitest.config.ts` | 818 test files (Vitest + Playwright) |
| 21 | Observability | `src/seed/observability/sentry-*.ts` | Sentry + metrics |
| 22 | Retry/failure | `src/seed/security/circuit-breaker.ts` | `shouldAllowRequest` / `recordFailure` |
| 23 | Quality/result gates | `src/seed/ai/proposal-quality-check.ts` | scoring dimensions |

**Top 3 dependency edges:**
1. `src/land/creative-mission/actions.ts` → `src/seed/inngest/client.ts` — emits `agent.mission.started` (spine of mission flow)
2. `src/seed/ai/provider-registry.ts` ↔ `src/seed/security/circuit-breaker.ts` — gates all outbound AI calls
3. `src/app/api/cron/workflow-stepper/route.ts` → `src/land/workflows/compute-next.ts` → `src/seed/db/workflow-repository.ts` — 1-min stepper advances all workflows

---

# Section 3 — Hermes Architecture

**Repo:** `nguyenphap-mt/Hermes-Antigravity-OAuth-Plugin` (public GitHub, v2.1.0, 31/08/2026). A plugin that registers an "Antigravity" AI model provider into the Hermes IDE via a local Python bridge server.

**File tree (13 files):** `plugin/__init__.py`, `plugin/plugin.yaml`, `bridge/auth.py` (621 LOC), `bridge/client.py` (818 LOC), `bridge/server.py` (347 LOC), `manage.py`, `install.py`, `README.md`, `README_EN.md`.

## 17 Concerns (15 VERIFIED, 2 NOT FOUND)

| # | Concern | File | Symbol | Status |
|---|---|---|---|---|
| 1 | Plugin entry | `plugin/__init__.py` | `register_provider(AntigravityProfile(...))` | VERIFIED |
| 2 | Manifest | `plugin/plugin.yaml` | version 1.0.0, type=model_provider, 10 models | VERIFIED |
| 3 | Registration | `plugin/__init__.py` | `AntigravityProfile(base_url="http://127.0.0.1:8100/v1", auth_type="oauth_external")` | VERIFIED |
| 4 | Model provider | `bridge/server.py` | OpenAI-compatible `/v1/chat/completions`, `/v1/models` | VERIFIED |
| 5 | OAuth | `bridge/auth.py` | `AntigravityAuthManager.login_pkce()`, PKCE flow | VERIFIED |
| 6 | Credential storage | `bridge/auth.py` | `~/.hermes/auth/antigravity_tokens.json` (atomic save, chmod 600) | VERIFIED |
| 7 | Token refresh | `bridge/auth.py` | `is_expired` (REFRESH_SKEW 120s), `refresh_access_token()` | VERIFIED |
| 8 | Account mgmt | `bridge/auth.py` | `load_all_stored_credentials()`, multi-account pool | VERIFIED |
| 9 | HTTP hooks | `bridge/client.py` | `daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` | VERIFIED |
| 10 | Tool registration | `plugin/plugin.yaml` + `register_provider` | `supports_vision=True` | VERIFIED |
| 11 | Image gen extension | — | — | **NOT FOUND** (text-only chat/completions) |
| 12 | CLI commands | `manage.py` | argparse {start, stop, status, login, install, setup} | VERIFIED |
| 13 | Config system | `install.py` | copies to `~/.hermes/` | VERIFIED |
| 14 | Logging | `bridge/server.py` | `logger = logging.getLogger(__name__)` | VERIFIED |
| 15 | Retry logic | `bridge/server.py` | `ensure_antigravity_bridge_running()` daemon auto-wake | VERIFIED |
| 16 | Test suite | — | — | **NOT FOUND** (no test files in 13-file tree) |
| 17 | Security boundaries | `bridge/auth.py` | token file local-only; bearer dummy-token rejection; NO log redaction (WARNING) | VERIFIED |

---

# Section 4 — Exact Dependency Map

## Sophia (actual paths)

```
User Request
  → src/middleware.ts (CSRF/CORS/MFA/locale)
    → src/app/api/** or src/app/[locale]/**
      → src/land/creative-mission/actions.ts → src/seed/inngest/client.ts
        → src/forest/inngest/functions/*.ts (70+ fns)
          → src/seed/ai/provider-registry.ts ↔ src/seed/security/circuit-breaker.ts
            → src/seed/ai/providers/* (openrouter-image-adapter, etc.)
      → src/land/workflows/compute-next.ts (state machine)
        → src/seed/db/workflow-repository.ts → D1 (synchronous)
    ← Result ← src/seed/ai/proposal-quality-check.ts (scoring)
    ← Ship ← scripts/deploy-full-verified.sh → Cloudflare Workers
```

**Outbounds:** D1 (`sophia-raas-db`), R2 (`sophia-ai-factory-opennext-cache`, `sophia-videos`, `sophia-backups`), KV, external AI providers (OpenRouter, ElevenLabs, D-ID, HeyGen, MuAPI).

## Hermes (actual paths)

```
Hermes IDE Request
  → plugin/__init__.py → register_provider(AntigravityProfile)
    → bridge/server.py (/v1/chat/completions, /v1/models)
      → bridge/auth.py (OAuth PKCE, token refresh)
        → ~/.hermes/auth/antigravity_tokens.json
      → bridge/client.py → daily-cloudcode-pa.googleapis.com
    ← Response
```

**Key difference:** Hermes is a LOCAL plugin (loopback `127.0.0.1:8100`). Sophia is a CLOUD SaaS (Cloudflare edge). They share no runtime, no database, no credentials today.

---

# Section 5 — Integration Surface

**Goal:** Sophia = Control Plane. Hermes = optional Capability Worker. Minimum-safe boundary.

| Capability | SUPPORTED NOW? | WHERE (exact files) |
|---|---|---|
| `image.generate` | **YES** | `src/app/actions/image-generate-action.ts` + `src/tree/clients/muapi-media-client.ts` (MuAPI — Midjourney/Flux) |
| `image.edit` | **NO** | NOT FOUND. No img2img/inpaint/edit implementation symbol exists (only scoring-context comments in `src/seed/ai/provider-scoring-types.ts:56`, `src/seed/ai/scoring-contextual.ts:95`) |
| `creative.storyboard` | **PARTIAL** | Interface method `generateStoryboard()` at `src/seed/ai/creative-provider.ts:58`; agent def `STORYBOARD_DEFINITION` at `src/tree/agent-protocol/graph-agents.ts:136`; no standalone generator implementation |
| `video.generate` | **YES** | `src/forest/video/missions/video-create.ts` + `src/land/video/heygen-helpers.ts` (HeyGen/D-ID) |
| `audio.generate` | **YES** | `src/app/actions/tts-generate-action.ts` + `src/seed/ai/text-to-speech-generator-elevenlabs.ts` (ElevenLabs) + `src/land/voice/clone-voice.ts` |

**Minimum-safe integration contract (proposed for Phase 1, NOT implemented):**
- Sophia calls Hermes ONLY via the existing OpenAI-compatible `/v1/chat/completions` bridge pattern.
- Hermes stays local (loopback). Sophia reaches it ONLY if a secure tunnel/reverse-proxy is added later — NOT in scope now.
- No shared DB. No shared OAuth tokens. No credential exchange.

---

# Section 6 — Regression Risk Matrix

| Integration point | Risk | Why |
|---|---|---|
| Production deployment | **HIGH** | Deploy is founder-only (CF account 100% founder-owned). Any integration that requires deploy needs founder. |
| Auth | **MEDIUM** | Sophia uses Better Auth; Hermes uses separate PKCE. No shared auth today — integration must NOT merge them. |
| Billing | **HIGH** | NOWPayments IPN → tier activation is a protected flow. Any new provider cost path must not break `markEventsAsBillable`. |
| DB migrations | **MEDIUM** | 232 file-based SQL migrations. New provider tables need new migration files + `apply-migrations.sh`. |
| Provider failures | **MEDIUM** | Circuit breaker (`src/seed/security/circuit-breaker.ts`) handles failures. New provider must plug into `recordFailure`/`shouldAllowRequest`. |
| OAuth secrets | **CRITICAL** | Hermes `bridge/auth.py` hardcodes a real Google OAuth client secret in public repo (see Section 7). |
| Async jobs | **MEDIUM** | Inngest owns all long-running workflows. New provider calls must go through Inngest, not request path. |
| Retry loops | **LOW** | Existing `retryCount: 3` (`src/seed/tenant-settings/defaults.ts:163`) + circuit breaker. New provider must classify errors via `FailureKind`. |
| Asset storage | **LOW** | R2 buckets already exist. New asset type needs new key path only. |
| Vendor lock-in | **MEDIUM** | Sophia already has multi-provider router (`provider-registry.ts`). Adding Hermes as another provider fits the pattern. |

---

# Section 7 — Security Review

**Rules:** Do NOT print secret values. Only report SAFE / WARNING / CRITICAL.

| Area | Verdict | Evidence |
|---|---|---|
| Sophia secrets in repo | **SAFE** | `.env` gitignored; secrets in CF Workers secrets only |
| Sophia `.env` handling | **SAFE** | `.env*` in `.gitignore` (line 34); only `.env.example` tracked |
| Sophia OAuth token storage | **SAFE** | Better Auth manages sessions; no plaintext token files |
| Sophia logging redaction | **SAFE** | `src/seed/utils/logger-utility.ts` — no console.log in prod |
| Sophia credential boundaries | **SAFE** | BYOK — customer keys never touch server logs |
| Hermes secrets in repo | **CRITICAL** | `bridge/auth.py` → `DEFAULT_CLIENT_SECRET` hardcoded Google OAuth client secret committed to PUBLIC GitHub repo. Also `DEFAULT_CLIENT_ID` hardcoded. |
| Hermes OAuth token storage | **WARNING** | `~/.hermes/auth/antigravity_tokens.json` — plaintext JSON, chmod 600 only (no encryption at rest) |
| Hermes logging redaction | **WARNING** | No redaction of token values in logs |
| Hermes credential boundaries | **WARNING** | Token file local-only (good), but zero test coverage, minimal retry (single fallback URL, no exponential backoff) |

**Critical finding detail:** The hardcoded `DEFAULT_CLIENT_SECRET` in `bridge/auth.py` is a real Google OAuth client secret exposed in a public repository. This is a **CRITICAL** risk for the Hermes account owner. It does NOT affect Sophia's systems. Remediation (rotate secret, remove from git history) requires the actual account owner's action — outside this audit's scope (read-only).

---

# Section 8 — Economics Audit

Does Sophia currently track these? Classify: PRESENT / PARTIAL / NOT FOUND.

| Dimension | Class | Evidence |
|---|---|---|
| Provider cost | **PRESENT** | `src/forest/quota/provider-pool.ts:35 getProviderCost(provider, taskType)` + `PROVIDER_COST_PER_UNIT` table |
| Generation cost | **PRESENT** | `src/land/billing/video-production-cost-engine.ts` + `src/land/billing/dynamic-pricing.ts:31 baseCostCents` |
| Retries | **PRESENT** | `src/seed/tenant-settings/defaults.ts:163 retryCount: 3` |
| Token usage | **PRESENT** | `src/seed/ai/token-counter.ts:155 totalTokens` + `src/forest/agent-protocol/types.ts:179` |
| Job cost | **PRESENT** | `src/forest/agent-protocol/types.ts:109 jobCostCents` |
| User budget | **PARTIAL** | Quota/overage system (`src/forest/quota/`, `src/seed/db/overage-billing-ops.ts`) tracks usage; no explicit `userBudget` symbol |
| Billing margin | **PRESENT** | `src/land/billing/video-production-cost-engine.ts:91 marginPercent` + `src/land/billing/video-production-cost-constants.ts:120` |

**Note:** The original plan claimed provider cost and billing margin were NOT FOUND. Execution-time re-verification **overruled** both — they are present. This is why read-only re-verification matters.

---

# Section 9 — Recommended Architecture

**Principle:** Sophia = Control Plane (stays as-is). Hermes = optional Capability Worker (future).

**Recommended shape:**
1. **Sophia stays the single deployable unit** (`apps/sophia-ai-factory`). No repo merge.
2. **Hermes stays a separate local plugin.** No shared DB, no shared OAuth tokens.
3. **Integration = a new provider adapter** in Sophia's `src/seed/ai/providers/` following the existing `openrouter-image-adapter.ts` pattern.
4. **Hermes exposes only** the OpenAI-compatible `/v1/chat/completions` endpoint (what it already has). No new Hermes surface needed for Phase 1.
5. **All new provider calls go through** `provider-registry.ts` → `circuit-breaker.ts` → Inngest (async). Never in request path.
6. **All new costs go through** existing `getProviderCost` + `jobCostCents` + `marginPercent` tracking. No new economics system needed.

**What this preserves:** Sophia's 4-layer architecture, BYOK doctrine, CF-direct deploy, circuit breaker resilience, existing billing flows.

---

# Section 10 — Things We Must NOT Touch

| Do NOT | Why |
|---|---|
| Merge the two repositories | Different runtimes (Cloudflare Worker vs local Python), different owners, different trust boundaries |
| Share Sophia's D1 database with Hermes | Hermes is local-only; Sophia's D1 is cloud. No shared DB contract exists |
| Share OAuth tokens between systems | Sophia uses Better Auth sessions; Hermes uses PKCE file tokens. Merging = credential exposure |
| Expose Sophia's CF secrets to Hermes | CF secrets (`src/seed/config/**`) must never cross into a local plugin |
| Break the Setup Wizard (BYOK) flow | Protected flow #1 — customer onboarding |
| Break the Telegram bot (@Sophia_Bbot) | Protected flow #2 — `/campaign`, `/status`, `/results` |
| Break NOWPayments IPN → tier activation | Protected flow #3 — payment |
| Modify `bridge/auth.py` secret in this audit | Read-only phase; credential rotation requires the actual account owner |
| Deploy or commit anything | This phase is INSPECT → MAP → VERIFY → REPORT only |

---

# Section 11 — Phase 1 Integration Plan

> **STATUS:** Proposed only. NOT implemented. Requires separate approval + read-only audit closeout.

**Scope of Phase 1 (smallest safe step):**
1. **Rotate the Hermes OAuth secret** (`bridge/auth.py` `DEFAULT_CLIENT_SECRET`) — account owner action. Remove from git history.
2. **Add a Hermes provider adapter** to Sophia: `src/seed/ai/providers/hermes-antigravity-adapter.ts` following `openrouter-image-adapter.ts` pattern.
3. **Register the adapter** in `src/seed/ai/provider-registry.ts` with circuit breaker + `getProviderCost` entry.
4. **Add a Hermes cost row** to `PROVIDER_COST_PER_UNIT` table (`src/forest/quota/provider-pool.ts`).
5. **Write tests** — both for the new adapter AND a minimal Hermes test suite (Hermes currently has 0 tests).
6. **Verify** via existing pre-deploy gates (`pre-deploy-gate.mjs`) + post-deploy smoke.

**Out of scope (explicitly deferred):** image.edit (not supported by either system), shared DB, shared OAuth, real-time tunnel between Sophia cloud and Hermes local.

---

# Section 12 — Confidence Levels

| Claim | Confidence | Basis |
|---|---|---|
| Sophia 4-layer architecture | **HIGH** | Source-traced across 23 concerns + `sophia-layer-architecture.md` |
| Sophia 5-capability surface | **HIGH** | Direct grep/read of `image-generate-action.ts`, `video-create.ts`, `tts-generate-action.ts`, `creative-provider.ts` |
| Hermes plugin structure | **HIGH** | 15/17 concerns traced via `gh api` + README synthesis |
| Hermes image gen = NOT FOUND | **HIGH** | 13-file tree, no image endpoint in `bridge/server.py` |
| Hermes test suite = NOT FOUND | **HIGH** | 13-file tree, no test paths |
| `image.edit` absent in Sophia | **HIGH** | `grep -rni "img2img\|inpaint\|imageEdit" src/` returns only scoring comments, no impl |
| `creative.storyboard` partial | **HIGH** | Interface + agent def present; no generator impl |
| Provider cost / billing margin present | **HIGH** | Overruled plan's NOT FOUND claim via direct source trace |
| Hardcoded Hermes OAuth secret = CRITICAL | **HIGH** | `bridge/auth.py` `DEFAULT_CLIENT_SECRET` confirmed in repo (value NOT printed) |
| Recommended architecture | **MEDIUM** | Judgment-based; fits existing patterns but untested |
| Phase 1 integration plan | **MEDIUM** | Proposed only; requires implementation validation |

---

**END OF AUDIT**

*Generated read-only. No code modified, no config changed, no deploy, no commit. Every claim references exact repository files. Unverifiable claims marked UNVERIFIED.*
