# Recon-02: AI Provider Layer Matrix & Hermes Reconciliation

**Scope:** Sections 4 & 5 — Read-only audit of every AI provider and Hermes certification gap analysis.

---

## Section 4 — AI Provider Layer Matrix

### 4.1 Canonical Provider Table

| Provider | Interface | Chat | Reasoning | Image | Video | Audio | Vision | Cost | Health | Production |
|---|---|---|---|---|---|---|---|---|---|---|
| **OpenRouter** (text) | `OpenRouterProvider` (`forest/ai/openrouter-provider.ts:108`) | YES | YES | NO | NO | NO | Model-dependent | Metered | CB + 3-fail cooldown | PROD |
| **OpenRouter** (image) | `OpenRouterImageAdapter` (`seed/ai/providers/openrouter-image-adapter.ts:102`) | NO | NO | YES (DALL-E, SDXL, Imagen) | NO | NO | NO | Metered | CB `openrouter-image` | PROD |
| **Claude-Fable** (Anthropic) | `AnthropicProvider` (`forest/ai/Claude-Fable-provider.ts:77`) | YES | YES | NO | NO | NO | YES | Metered | Health tracker (no CB in adapter) | PROD |
| **ElevenLabs** | `ElevenLabsApiClient` (`seed/ai/elevenlabs-api-client.ts:12`) | NO | NO | NO | NO | YES (TTS) | NO | Metered (per char) | CB + health | PROD |
| **Wan 2.1** | `WanVideoClient` (`land/video/generation/wan21-client.ts:38`) | NO | NO | NO | YES (t2v, i2v) | NO | NO | Metered (per sec) | CB | PROD |
| **Fish Speech** | (adapter not found — cost model only) | NO | NO | NO | NO | YES (TTS) | NO | Metered (per char) | Unknown | UNKNOWN |
| **Hermes Antigravity** | `HermesAntigravityAdapter` (`seed/ai/providers/hermes-antigravity-adapter.ts:84`) | YES | YES | YES (SDXL via /v1/images/generations) | NO | NO | Input-only | Unmetered (local) | CB `hermes-antigravity` | NOT READY |
| **HeyGen** | `HeyGenClient` (`land/heygen/heygen-client.ts:24`) | NO | NO | NO | YES (talking avatar) | NO | NO | Metered (per sec) | KV-backed CB | PROD |
| **D-ID** | `createDidTalk` (`forest/did/did-client.ts:28`) | NO | NO | NO | YES (talking head) | NO | NO | Metered | CB | PROD |
| **Replicate** | `ReplicateVideoService` (`land/services/replicate/replicate-video-service.ts:38`) | NO | NO | NO | YES (Wav2Lip) | NO | NO | Metered | CB | PROD fallback |
| **MuAPI** | `submitMediaJob` (`tree/clients/muapi-media-client.ts:24`) | NO | NO | YES | YES | YES | NO | Metered | CB | PROD |
| **Apollo** | `apolloPeopleSearch` (`tree/apollo/apollo-client.ts:28`) | NO | NO | NO | NO | NO | NO | Metered | **NO CB** | PROD (gap) |
| **Hunter** (intelligence) | `findEmail` (`land/intelligence/hunter-client.ts:24`) | NO | NO | NO | NO | NO | NO | Metered | **NO CB** | PROD (gap) |
| **Hunter** (land) | `findEmail` (`land/hunter/hunter-client.ts:24`) | NO | NO | NO | NO | NO | NO | Metered | CB + per-key | PROD |
| **MockImageGeneration** | `MockImageGenerationProvider` (`seed/ai/providers/mock-image-generation-provider.ts:28`) | NO | NO | YES (deterministic) | NO | NO | NO | Internal | None | TEST ONLY |
| **MockProvider** | `createMockProvider` (`forest/ai/mock-provider.ts:24`) | YES (stub) | NO | NO | NO | NO | NO | Internal | None | TEST ONLY |

### 4.2 Hermes-Specific Deep Dive

| Dimension | Value | Evidence |
|---|---|---|
| Interface class | `HermesAntigravityAdapter implements Provider` | `seed/ai/providers/hermes-antigravity-adapter.ts:84` |
| ProviderId | `'hermes'` | `seed/ai/provider-interface.ts:28` |
| Default base URL | `http://127.0.0.1:8100` | `hermes-antigravity-adapter.ts:91` |
| Auth | Bearer <REDACTED> (`Authorization: Bearer ${apiKey}`) | `hermes-antigravity-adapter.ts:153` |
| BYOK supported | Yes — in `byokSupported` array at `provider-factory.ts:146` and `ByokProvider` at `user-api-key-store.ts:16` | |
| API endpoint called | `POST /v1/images/generations` | `hermes-antigravity-adapter.ts:151` |
| Cost semantics | `unmetered` — always returns 0 USD | `cost-estimator.ts:316`, `hermes-antigravity-adapter.ts:255` |
| Timeout | 120,000ms default | `hermes-antigravity-adapter.ts:158` |
| Circuit breaker | Generic 4-state D1-backed (`shouldAllowRequest('hermes-antigravity')`) | `hermes-antigravity-adapter.ts:118` |
| Retry | None in adapter — relies on router fallback | |
| Health check | ProviderHealth tracker (3 failures → 30s cooldown) | `seed/ai/provider-health.ts` |
| Fallback position | `['openrouter', 'anthropic', 'elevenlabs']` — Hermes NOT in default fallback | `provider-registry.ts:49` |
| Telemetry | `classifyError` + `recordSuccess/recordFailure` on all paths | `hermes-antigravity-adapter.ts:161,189,214` |
| Capabilities declared | `chat, stream, token_count, creativeReason, creativeStoryboard, creativePromptOptimize, imageGenerate=false, vision='input-only'` | `seed/ai/providers/hermes-capabilities.ts:38-47` |

### 4.3 Provider Categories

**Provider Interface implementors** (full `Provider` contract):
- `OpenRouterProvider` (text)
- `OpenRouterImageAdapter` (image)
- `AnthropicProvider` (Claude-Fable)
- `HermesAntigravityAdapter`

**Non-Provider clients** (direct HTTP or domain-specific interfaces):
- ElevenLabsApiClient (TTS)
- HeyGenClient (video avatar)
- createDidTalk (video talking head)
- ReplicateVideoService (lip-sync)
- WanVideoClient (video t2v/i2v)
- MuAPI (media jobs)
- Apollo (people search)
- Hunter x2 (email find/verify)

**Test-only / mock:**
- MockImageGenerationProvider (deterministic FNV-1a)
- MockProvider (createMockProvider factory)

---

## Section 5 — Hermes Reconciliation

### Q1: Where is Hermes registered?

**Answer:** Three locations:

1. **`provider-interface.ts:28`** — `ProviderId` union includes `'hermes'`
2. **`provider-factory.ts:197-202`** — `createProvider()` switch case for `'hermes'` instantiates `HermesAntigravityAdapter`
3. **`ByokProvider` type at `user-api-key-store.ts:16`** — `'hermes'` in union for user_api_keys table
4. **`byokSupported` array at `provider-factory.ts:146`** — `['openrouter', 'anthropic', 'elevenlabs', 'hermes']`

Registration is unconditional — `createProvider({id: 'hermes'})` succeeds without any certification gate, license check, or readiness flag.

### Q2: Where is Hermes selected?

**Answer:** Two locations, neither primary routing:

1. **`cost-aware-router.ts:478`** — Default fallback model: `'hermes/hermes-1'` is the fallback for the `hermes` ProviderId when cost-aware routing needs a default model
2. **NOT in `llm-router.ts`** — `CLOUD_MODELS` (line 70-74) only contains `openrouter` and `anthropic`. The `selectRoute()` function (line 82-93) can ONLY return `'openrouter'` or `'anthropic'`.

**Conclusion:** Hermes is NEVER selected by the primary LLM routing logic. It can only be reached:
- Direct instantiation via `createProvider({id: 'hermes'})`
- Explicit caller passing `providerId: 'hermes'` in options
- Fallback chain if explicitly registered AND other providers fail

### Q3: What capabilities does Sophia believe Hermes has?

**Answer:** From `hermes-capabilities.ts:38-47`:

```typescript
{
  chat: true,
  stream: true,
  token_count: true,
  creativeReason: true,
  creativeStoryboard: true,
  creativePromptOptimize: true,
  imageGenerate: false,
  vision: 'input-only'
}
```

From `hermes-antigravity-adapter.ts:260-270` (getCapabilities return):
- streaming: true
- systemRole: true
- maxOutputTokens: 8192
- maxInputTokens: 32768
- functionCalling: false
- vision: true (maps 'input-only' → true via `caps.vision !== false`)

**Critical contradiction:** `getCapabilities()` returns `vision: true` even though `isHermesSupported('vision')` returns `false`. Two different code paths give different answers about Hermes vision support.

### Q4: Does that match the Hermes Provider Certification?

**Certification status referenced:**
- Security: BLOCKED
- Health: BLOCKED
- Capability Truth: PASS
- Reliability: PASS
- Circuit Breaker: PASS
- Economics: PASS
- Canary: BLOCKED
- Production: NOT READY

**Reconciliation:**

| Certification Claim | Code Evidence | Match? |
|---|---|---|
| Security BLOCKED | No security gate, license check, or enable-flag on Hermes. `createProvider` succeeds unconditionally. | Code does NOT enforce BLOCKED status |
| Health BLOCKED | Circuit breaker + health tracker present. Default base URL is localhost (127.0.0.1:8100) — will never work in Cloudflare Workers edge runtime (no localhost). | **Confirmed broken** — adapter default is incompatible with deployment target |
| Capability Truth PASS | `imageGenerate: false` declared, adapter rejects `image.generate` capability (line 110-116) | PASS — truthful declaration |
| Reliability PASS | 120s timeout, circuit breaker, failure classification | PASS |
| Circuit Breaker PASS | Uses `seed/security/circuit-breaker.ts` (4-state D1-backed) | PASS |
| Economics PASS | `unmetered` kind, estimateCost returns 0 | PASS (but see Q10) |
| Canary BLOCKED | No canary mechanism found | Code does NOT enforce |
| Production NOT READY | No production gate, no readiness flag | Code does NOT enforce |

**Verdict:** Code truthfully declares capabilities (Capability Truth PASS) but does NOT enforce the BLOCKED/NOT READY certification statuses. An operator can instantiate Hermes and route traffic to it without any guard.

### Q5: Is Hermes allowed to generate images?

**Answer:** YES — by implementation, despite capability declaration saying NO.

**Evidence:**
1. **`hermes-antigravity-adapter.ts:151`** — chat() calls `POST ${this.baseUrl}/v1/images/generations`
2. **`hermes-antigravity-adapter.ts:217`** — Returns image as `data:image/png;base64,${b64}`
3. **Test at `hermes-antigravity-adapter.test.ts:51-62`** — Happy path test verifies image generation (expects base64 data URI)
4. **Module doc string (line 4-8):** "Hermes Antigravity (local) image generation adapter."

**But:** Lines 110-116 reject `extraBody.capability === 'image.generate'` or `extraBody.imageGenerate === true`. This only blocks EXPLICIT capability flag — NOT the default chat() path which ALWAYS calls `/v1/images/generations`.

**Contradiction summary:**
- `HERMES_CAPABILITIES.imageGenerate = false` (line 45)
- `isHermesSupported('imageGenerate')` returns false (line 75-76)
- Module is named "image generation adapter"
- Default chat() path calls `/v1/images/generations`
- Only explicit `image.generate` capability flag is rejected

### Q6: Is Hermes allowed to generate video?

**Answer:** NO. No video capability anywhere in Hermes adapter, capabilities declaration, or factory wiring. Video is handled by dedicated services: HeyGen, D-ID, Replicate, Wan21 (none of which route through Hermes).

### Q7: What happens if Hermes is unavailable?

**Answer:** Router fallback chain takes effect:

1. **`provider-registry.ts:49`** — Default fallback: `['openrouter', 'anthropic', 'elevenlabs']` — Hermes NOT included
2. **`cost-aware-router.ts:478`** — If hermes was the selected provider and fails, router walks the fallback chain which excludes hermes
3. **`multi-provider-router.ts`** — isRetryable() checks error patterns: 401/403 → not retryable; 429/5xx → retryable
4. **Circuit breaker:** `seed/security/circuit-breaker.ts` tracks failures → after threshold, opens circuit → future requests immediately rejected until cooldown

If Hermes is the ONLY provider configured (BYOK-only mode with just hermes key), and it fails:
- `AllProvidersFailedError` is thrown
- No fallback available
- Request fails to user

### Q8: Does router fallback correctly?

**Answer:** Yes, with caveats:

**Correct behavior:**
- Default fallback order `['openrouter', 'anthropic', 'elevenlabs']` excludes Hermes (prevents accidental fallback to localhost-only provider)
- Health-aware: only healthy providers returned in chain
- Cost-aware: `rankCost` at `cost-aware-router.ts:392-405` ranks unmetered (Hermes) at `cheapestMeteredCost + EPSILON` — never above cheapest metered

**Caveat:**
- If operator EXPLICITLY configures only Hermes (no other providers), fallback chain is empty and `AllProvidersFailedError` occurs on failure
- `cost-aware-router.ts:478` default model mapping assumes hermes can appear in chain — but it never will in default config

### Q9: Can Hermes ever become an accidental single point of failure?

**Answer:** NO in default configuration, YES in edge cases.

**Default: NO**
- Hermes not in default fallback order
- Primary routing (llm-router) never selects Hermes
- Requires explicit configuration to enable

**Edge case: YES possible**
- If user ONLY has Hermes BYOK key configured (no OpenRouter, no Anthropic, no ElevenLabs), then `provider-factory.ts:102-109` skips all providers without keys, leaving only Hermes
- If Hermes is explicitly registered via `registry.register()` and no other providers registered → single point of failure
- No guard prevents this configuration

### Q10: Is Hermes economically classified correctly as UNMETERED?

**Answer:** YES, with honest metadata.

**Evidence:**
- `cost-estimator.ts:316`: `hermes: 'unmetered'` in `PROVIDER_COST_KIND`
- `cost-estimator.ts:359-361`: `estimateCostV2` returns `{ usd: 0, kind: 'unmetered' }` for unmetered providers
- `hermes-antigravity-adapter.ts:255`: `estimateCost()` returns 0
- `cost-aware-router.ts:399-401`: Unmetered providers ranked at `cheapestMeteredCost + EPSILON` — never treated as "free"

**Semantic honesty:** The `unmetered` classification means "real resource cost but not billed per-request" — accurate for local runtime. The router correctly avoids ranking Hermes as cheapest despite 0 USD cost.

**Note:** PROVIDER_DEFAULTS at line 151 still has `{ type: 'text', input: 0.5, output: 2.0 }` for hermes — but this is only used as fallback pricing, never as the actual cost kind for routing decisions.

### Q11: Is Hermes security status propagated correctly?

**Answer:** NO — there is no security status propagation.

**Evidence:**
- No `securityStatus` or `certificationStatus` field on Provider interface (`provider-interface.ts:105-118` capabilities only)
- No check in `provider-factory.ts` createProvider for Hermes certification status
- No check in `cost-aware-router.ts` or `multi-provider-router.ts` for provider security status
- Hermes adapter has no `securityStatus` property
- The `ProviderCapabilities` interface only covers functional capabilities (streaming, vision, etc.) — not security/certification

**Gap:** Even though Hermes certification says "Security BLOCKED", the code has no mechanism to read or enforce this status. Any caller can instantiate and use Hermes without encountering a security gate.

### Q12: Can an operator accidentally enable Hermes before certification?

**Answer:** YES — there is no mechanism to prevent this.

**Accidental enable paths:**
1. **Environment variable:** Setting `HERMES_API_KEY` env var + passing `{id: 'hermes'}` to `buildProviders()` → provider instantiated
2. **BYOK:** User stores hermes key via Setup Wizard (`ByokProvider` includes `'hermes'`) → `resolveUserApiKey` returns key → `createProvider` succeeds
3. **Direct code:** `new HermesAntigravityAdapter({apiKey: '...'})` — no gate, no throw on construction
4. **Config-driven:** Any config object with `{id: 'hermes', apiKey: '...'}` passed to `buildProviders`

**No guard exists:**
- No `isHermesCertified()` function
- No `HERMES_ENABLED` feature flag
- No check in `provider-factory.ts` createProvider switch
- No license file validation
- No network check to Hermes certification service

---

## Compact Summary

### Provider Count
- **Total distinct providers:** 15 (including 2 mock)
- **Full Provider interface implementors:** 4 (OpenRouter text, OpenRouter image, Claude-Fable, Hermes)
- **Non-Provider HTTP clients:** 9 (ElevenLabs, HeyGen, D-ID, Replicate, Wan21, MuAPI, Apollo, Hunter x2)
- **Test-only:** 2 (MockImage, MockProvider)

### Critical Findings

| # | Finding | Severity | Location |
|---|---|---|---|
| 1 | **Hermes capability contradiction:** chat() calls /v1/images/generations (image generation) but `imageGenerate: false` in capabilities | HIGH | `hermes-antigravity-adapter.ts:151` vs `hermes-capabilities.ts:45` |
| 2 | **Hermes not in default fallback** — excluded from `['openrouter', 'anthropic', 'elevenlabs']` | INFO | `provider-registry.ts:49` |
| 3 | **Hermes not in llm-router routing matrix** — cannot be selected by complexity-based routing | INFO | `llm-router.ts:70-74` |
| 4 | **Hermes certification status not enforced** — no gate prevents instantiation | HIGH | `provider-factory.ts:197-202` |
| 5 | **Apollo client has NO circuit breaker** — direct fetch without shouldAllowRequest | MEDIUM | `tree/apollo/apollo-client.ts` |
| 6 | **Hunter has two implementations** — one with CB (`land/hunter/hunter-client.ts`), one without (`land/intelligence/hunter-client.ts`) | MEDIUM | Duplicate implementations |
| 7 | **Two circuit breaker implementations** — generic D1-backed (`seed/security/circuit-breaker.ts`) + HeyGen-specific KV-backed (`seed/utils/circuit-breaker.ts`) | LOW | Architectural debt |
| 8 | **Hermes default base URL is localhost** (`127.0.0.1:8100`) — incompatible with Cloudflare Workers edge runtime | HIGH | `hermes-antigravity-adapter.ts:91` |
| 9 | **isHermesSupported vs getCapabilities disagree** on vision: former returns false for 'input-only', latter returns true | MEDIUM | `hermes-capabilities.ts:75` vs `hermes-antigravity-adapter.ts:269` |
| 10 | **BYOK supports Hermes** but Hermes is localhost-only — users cannot provide a useful Hermes key | MEDIUM | `user-api-key-store.ts:16`, `provider-factory.ts:146` |

### Hermes Provider Certification Reconciliation Verdict

| Dimension | Certification | Code Reality | Match? |
|---|---|---|---|
| Security | BLOCKED | No enforcement | **MISMATCH** |
| Health | BLOCKED | Localhost default, no edge support | **Confirmed broken** |
| Capability Truth | PASS | Declared false, implemented true | **MISMATCH** (contradiction) |
| Reliability | PASS | CB + timeout + classification | MATCH |
| Circuit Breaker | PASS | 4-state D1-backed CB | MATCH |
| Economics | PASS | Unmetered correctly implemented | MATCH |
| Canary BLOCKED | BLOCKED | No canary mechanism | **MISMATCH** (not enforced) |
| Production NOT READY | NOT READY | No readiness gate | **MISMATCH** (not enforced) |

**Overall:** Hermes adapter is IMPLEMENTED and FUNCTIONAL as a local image-generation endpoint, but the capability declaration contradicts the implementation, and no certification gates exist to prevent production use.

---

*End of Recon-02*
