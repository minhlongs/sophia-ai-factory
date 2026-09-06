# Plan: Sophia Hermes Integration Phase 1

> Source of truth: `docs/CEO_HANDOVER_AUDIT.md` Section 11
> Prerequisite: Hermes OAuth secret rotation (account owner action — NOT a code task)
> Scope: Thin, read-only provider bridge ONLY

---

## Reframed Problem

Sophia is a cloud SaaS for AI video/image generation. Hermes is a local plugin (loopback 127.0.0.1:8100). They share no runtime, DB, or credentials today. The audit requires a Hermes provider adapter so Sophia can route image generation requests to Hermes when it becomes available as a BYOK provider.

**Blocker:** Hermes `bridge/auth.py` hardcodes a real Google OAuth client secret in a public GitHub repo — CRITICAL security exposure. This must be rotated before any integration code is written or tested against real Hermes.

**V1 scope:** Mock-only adapter that wires into Sophia's existing provider infrastructure, ready for real Hermes API when credentials are available. No production Hermes calls.

---

## File Ownership

| Phase | Files |
|---|---|
| Phase A: Provider Interface Extension | `src/seed/ai/provider-interface.ts` (add `'hermes'` to ProviderId) |
| Phase B: Hermes Adapter | `src/seed/ai/providers/hermes-antigravity-adapter.ts` (NEW) |
| Phase C: Registry Registration | `src/forest/ai/provider-factory.ts` (register hermes in shared registry) |
| Phase D: Cost Table | `src/seed/config/routing-strategies.ts` (add `'hermes'` to VideoProvider if needed) OR new creative-only cost table |
| Phase E: Tests | `src/seed/ai/providers/__tests__/hermes-adapter.test.ts` (NEW) |
| Phase F: Docs | `docs/HERMES_INTEGRATION_V1.md` (NEW) |

**Constraint:** No changes to auth, billing, video pipelines, or protected flows (Setup Wizard / Telegram / NOWPayments).

---

## Phase A: Extend ProviderId Type (2 files)

**What:** Add `'hermes'` to the provider type system so the adapter can be registered.

**File 1:** `src/seed/ai/provider-interface.ts:28`
```ts
export type ProviderId = 'openrouter' | 'Claude-Fable' | 'elevenlabs' | 'wan' | 'fish-speech' | 'hermes';
```

**File 2:** `src/tree/byok/user-api-key-store.ts:16` — add `'hermes'` to `ByokProvider`:
```ts
export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'replicate' | 'muapi' | 'apollo' | 'hunter' | 'hermes';
```

**Acceptance:**
- [ ] TypeScript compiles with 0 new errors
- [ ] All existing providers unaffected
- [ ] BYOK store accepts hermes keys

**Agent:** `fullstack-developer`

---

## Phase B: Hermes Adapter (Core)

**What:** Create `HermesAntigravityAdapter` following `OpenRouterImageAdapter` pattern.

**File (NEW):** `src/seed/ai/providers/hermes-antigravity-adapter.ts`

**Design:**
```ts
export class HermesAntigravityAdapter implements Provider {
  readonly id: ProviderId = 'hermes';
  readonly label: string;
  readonly apiKey: string | undefined;
  readonly baseUrl: string; // default: http://127.0.0.1:8100

  constructor(config: HermesAdapterConfig = {}) { ... }

  async chat(messages, options): Promise<ChatResponse> { ... }
  async *stream(messages, options): AsyncGenerator<StreamChunk> { ... }
  countTokens(messages, model): number { ... }
  estimateCost(messages, model, options?): number { ... }
  getCapabilities(model): ProviderCapabilities { ... }
}
```

**Contract (from audit):**
- Base URL: `http://127.0.0.1:8100` (local Hermes)
- Auth: Bearer token (BYOK — user provides their own Hermes API key)
- Zero construction-time throw on missing keys (Provider contract rule)
- Real HTTP call to Hermes when available; fail gracefully when not reachable
- Circuit breaker + failure classification per seed patterns
- Supports: `generate()` for image generation

**Acceptance:**
- [ ] `HermesAntigravityAdapter` implements `Provider` interface
- [ ] Construction never throws for missing credentials
- [ ] `chat()` uses `shouldAllowRequest`/`recordSuccess`/`recordFailure`
- [ ] `estimateCost()` returns 0 for Hermes (local, no per-request cost)
- [ ] `getCapabilities()` returns appropriate capabilities
- [ ] Timeout handling with `AbortController`
- [ ] Error classification: AUTH_FAILURE → immediate open, RATE_LIMIT → cooldown

**Agent:** `fullstack-developer`

---

## Phase C: Registry Registration

**What:** Register Hermes in the shared provider factory + extend BYOK support.

**File:** `src/forest/ai/provider-factory.ts`

**Changes (3 locations in this file):**

1. **Import** `HermesAntigravityAdapter` from `@/seed/ai/providers/hermes-antigravity-adapter`
2. **`createProvider()` switch** (line 182): add case:
   ```ts
   case 'hermes':
     return new HermesAntigravityAdapter({ apiKey, baseUrl: config.baseUrl, label: config.label });
   ```
3. **`resolveApiKey()` byokSupported list** (line 145): add `'hermes'`:
   ```ts
   const byokSupported: ByokProvider[] = ['openrouter', 'Claude-Fable', 'elevenlabs', 'hermes'];
   ```

**Acceptance:**
- [ ] `getSharedRegistry()` includes hermes when configured
- [ ] `createProvider()` handles `'hermes'` case
- [ ] BYOK key resolution works for hermes
- [ ] Fallback chain works: hermes → openrouter → Claude-Fable
- [ ] Health tracking works for hermes provider

**Agent:** `fullstack-developer`

---

## Phase D: Cost Table (Creative-Only)

**What:** Add Hermes to the cost estimation for creative image generation.

**Decision needed:** Hermes runs locally — cost per request = $0. But we need a cost entry so the routing strategy can consider it.

**Option 1 (preferred):** Add `hermes` to `PROVIDER_COST_PER_UNIT` with `creative: 0` (free, local).
**Option 2:** Create separate `CREATIVE_PROVIDER_COST` table if Hermes is NOT a `VideoProvider`.

**Since Hermes is NOT a VideoProvider** (video routing is separate from creative image routing), the cleanest approach is:
- Add `'hermes'` to a new `CreativeImageProvider` type in routing-strategies.ts
- Add `CREATIVE_IMAGE_PROVIDER_COST` table
- Or: keep Hermes cost in the adapter's `estimateCost()` method only (simplest for V1)

**V1 decision:** Keep Hermes cost in adapter only (`estimateCost() → 0`). No routing-strategies.ts changes needed for V1 since Creative Cell uses its own Inngest function, not the video routing pipeline.

**Acceptance:**
- [ ] Hermes adapter returns cost=0 from `estimateCost()`
- [ ] No changes to video routing pipeline
- [ ] Creative Cell Inngest function can use Hermes adapter via registry

**Agent:** `fullstack-developer`

---

## Phase E: Tests

**What:** Comprehensive test suite for Hermes adapter + registration.

**Files (NEW):**
- `src/seed/ai/providers/__tests__/hermes-adapter.test.ts`
- `src/seed/ai/__tests__/provider-registry-hermes.test.ts` (if separate file warranted)

**Test cases (minimum):**
1. ✅ Construction with/without API key
2. ✅ `chat()` happy path (mock HTTP 200 with image data)
3. ✅ `chat()` missing API key → throws with clear message
4. ✅ `chat()` HTTP 401/403 → ProviderInvalidKeyError
5. ✅ `chat()` HTTP 429/5xx → ProviderQuotaExceededError (retryable)
6. ✅ `chat()` timeout → ProviderNetworkError
7. ✅ `chat()` circuit breaker open → throws
8. ✅ `estimateCost()` returns 0
9. ✅ `getCapabilities()` returns expected capabilities
10. ✅ Registry includes hermes after registration
11. ✅ Fallback chain works with hermes

**Pattern:** Follow `vi.hoisted()` mock pattern from `creative-image-generate.test.ts`.

**Acceptance:**
- [ ] All 11+ tests pass
- [ ] 0 new `:any` types
- [ ] 0 new eslint-disable suppressions
- [ ] Circuit breaker integration tested

**Agent:** `tester`

---

## Phase F: Documentation

**What:** Create bilingual docs for Hermes integration.

**File (NEW):** `docs/HERMES_INTEGRATION_V1.md`

**Content:**
- Architecture (thin, read-only provider bridge)
- Prerequisites (OAuth secret rotation)
- Adapter contract
- BYOK key configuration
- Testing instructions
- Known limitations (local-only, no image.edit, no shared DB)
- Next phases

**Acceptance:**
- [ ] Bilingual Vietnamese + English
- [ ] No developer jargon in customer-facing sections
- [ ] Links to CEO_HANDOVER_AUDIT.md Section 11

**Agent:** `docs-manager`

---

## Risks & Gates

| Risk | Mitigation |
|---|---|
| Hermes OAuth secret still hardcoded in public repo | **BLOCKER** — document in plan, do NOT proceed to real API testing until rotated |
| Hermes local-only (127.0.0.1:8100) unreachable from CF Workers | Adapter fails gracefully; BYOK key from user's own Hermes instance |
| No Hermes test suite exists | Write minimal tests as part of this phase |
| ProviderId type change affects all consumers | TypeScript compiler catches all breakage; all existing adapters unaffected |

---

## Ship Plan

**Step 1 — Pre-Deploy Checklist:**
- [ ] `git status` clean
- [ ] `npm run typecheck` — 0 new errors
- [ ] `npm test` — all pass (8908+ baseline)
- [ ] `npm run build` — exit 0
- [ ] Protected flows untouched (Setup Wizard / Telegram / NOWPayments)
- [ ] 0 new `:any` types
- [ ] 0 new eslint-disable suppressions

**Step 2 — Commit + PR:**
- Conventional commit: `feat(hermes): add Hermes provider adapter (Phase 1)`
- PR with full body documenting scope

**Step 3 — Verify:**
- `npm run deploy:full` (if deploying)
- SHA match verification
- Production smoke test

**Step 4 — Docs Update:**
- Update `docs/HERMES_INTEGRATION_V1.md`
- Update ship report

---

## Definition of Done

PASS only if:
- ✅ `HermesAntigravityAdapter` implements `Provider` interface
- ✅ Registration in `ProviderRegistry` works
- ✅ Circuit breaker integration works
- ✅ All 11+ tests pass
- ✅ No auth/billing/video-pipeline regression
- ✅ No production deployment (V1 is mock-only)
- ✅ Bilingual docs created
- ✅ OAuth secret rotation documented as prerequisite

---

## Execution Order

```
Phase A (ProviderId type) → Phase B (Adapter) → Phase C (Registry) → Phase D (Cost) → Phase E (Tests) → Phase F (Docs)
```

Each phase spawns via `Task` tool to appropriate agent. Verify after each phase before proceeding.

---

*Plan written: 2026-09-06*
*Source: CEO_HANDOVER_AUDIT.md Section 11*
*Status: READY FOR PLAN GATE*
