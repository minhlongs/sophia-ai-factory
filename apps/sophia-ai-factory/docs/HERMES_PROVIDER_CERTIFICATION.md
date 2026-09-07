# Hermes Provider Certification Gate

> Sophia AI Factory — Certification Report
> Date: 2026-08-31 | Status: COMPLETE — Classification: NOT READY

---

## Security Gate

**Status: BLOCKED**

| Check | Status | Evidence |
|---|---|---|
| 1. OAuth secret no longer in active source | CANNOT VERIFY | External Hermes repo not on disk; audit confirmed hardcoded `DEFAULT_CLIENT_SECRET` in `bridge/auth.py` (public GitHub repo) |
| 2. Old exposed credential rotated/revoked | CANNOT VERIFY | No evidence of rotation; remediation requires account owner action (CEO_HANDOVER_AUDIT.md line 197) |
| 3. New credential injected through secure config | CANNOT VERIFY | `get_client_secret()` env-var fallback not confirmed set |
| 4. Secret scanning passes | CANNOT RUN | External repo not on disk |
| 5. Git history exposure documented | DOCUMENTED, NOT REMEDIATED | Audit documents the finding but states: "requires the actual account owner's action — outside this audit's scope" |
| 6. Local Hermes starts without hardcoded credentials | CANNOT VERIFY | `manage.py` not available on disk |

**Within Sophia's source:** Zero hardcoded Hermes secrets in `src/seed/ai/providers/hermes-*`. Adapter requires `apiKey` at call time, throws `HERMES_MISSING_API_KEY` if missing. Clean.

---

## Health Gate

**Status: BLOCKED**

- External Hermes repo not cloned locally (no `manage.py`, no `bridge/server.py`)
- No Hermes runtime endpoint reachable (`127.0.0.1:8100` unreachable)
- Security Gate BLOCKED prohibits authenticated health checks per task rules

---

## Capability Truth

**Status: PASS**

| Capability | Claim | Source Evidence | Test Evidence | Classification |
|---|---|---|---|---|
| `chat` | Supported | `chat()` method present (adapter:97–228) | 36/36 mock contract tests pass | SUPPORTED |
| `stream` | Supported | `stream()` wraps chat in single chunk (adapter:232–238) | Stream test passes | SUPPORTED (single-chunk) |
| `creative.reason` | Supported | `validateReasoningResponse()` Zod contract (`creative-intelligence.ts`) | Contract tests pass | SUPPORTED |
| `creative.storyboard` | Supported | `validateStoryboard()` Zod contract (`creative-storyboard.ts`) | Contract tests pass | SUPPORTED |
| `creative.prompt.optimize` | Supported | `validateOptimizeResponse()` Zod contract | Contract tests pass | SUPPORTED |
| `image.generate` | Explicitly Unsupported | `HERMES_CAPABILITY_UNSUPPORTED` thrown in `chat()` guard | `imageGenerate: false` in `HERMES_CAPABILITIES` | UNSUPPORTED (by design) |
| `image.edit` | Not claimed | Not in `HermesCapabilitySet` interface | N/A | NOT CLAIMED |
| `vision` | Input-only | `vision: 'input-only'` in capabilities; `isHermesSupported('vision')` = false | N/A | PARTIAL (input only) |

---

## Reliability

**Status: PASS**

| Failure Mode | Implementation | Test Evidence |
|---|---|---|
| Timeout | `AbortController` + `timeoutMs` (default 120s) | Category 5: "rejects when request exceeds timeout" |
| Connection refusal | `fetch()` throw → `classifyError()` + `recordFailure()` | "chat() network error propagates original error" |
| Malformed response | JSON parse → `HERMES_EMPTY_RESPONSE` if no `b64_json` | Category 7: structured output validation (4 tests) |
| Provider HTTP error | Status-based classification: 401/403 = retryable=false, 429/5xx = retryable=true | Tests for 401, 429, 500 |
| Auth failure | `HERMES_MISSING_API_KEY` thrown when no apiKey | "throws HERMES_MISSING_API_KEY when no apiKey available" |

---

## Timeout

**Status: PASS**

`AbortController` with configurable `timeoutMs`, default 120,000ms (2 minutes). Signal passed to `fetch()`. Verified in mock contract harness.

---

## Circuit Breaker

**Status: PASS**

| State Transition | Evidence |
|---|---|
| CLOSED → OPEN | `recordFailure()` opens after threshold |
| OPEN → HALF_OPEN | `shouldAllowRequest()` returns true after cooldown expires |
| HALF_OPEN → CLOSED | `recordSuccess()` after probe request succeeds |
| OPEN → reject | "rejects when circuit breaker is open" test passes |
| Recovery after cooldown | "allows request after cooldown expires" test passes |

Breaker key: `breakerKey('hermes-antigravity', 'platform')`.

---

## Economics

**Status: PASS**

| Item | Value | Source |
|---|---|---|
| `estimateCost()` | `0` (backward compat) | `adapter:250–256` |
| `estimateCostV2()` | `{ usd: 0, kind: 'unmetered' }` | `cost-estimator.ts` |
| `getModelCostKind('hermes')` | `'unmetered'` | `PROVIDER_COST_KIND` table |
| Router ranking | `unmetered` treated as `(cheapestMeteredCost + EPSILON)` | `rankCost()` in `cost-aware-router.ts` |
| Test coverage | 4 cost economics tests pass | Both test files |

Hermes is correctly classified as UNMETERED (local runtime, no per-request billing). Cost-aware router never ranks unmetered providers below cheapest metered provider.

---

## Provider Contract

**Status: PASS (with gap documented)**

| Method | Required | Present | Notes |
|---|---|---|---|
| `chat()` | Yes | Yes | Full implementation (adapter:97–228) |
| `stream()` | Yes | Yes | Single-chunk wrapper (adapter:232–238) |
| `countTokens()` | Yes | Yes | Approximate: `length/4 + 4` (adapter:242–246) |
| `estimateCost()` | Yes | Yes | Returns 0 (adapter:250–256) |
| `getCapabilities()` | Yes | Yes | Derives from `getHermesCapabilities()` (adapter:260–270) |
| `health()` | **No** | No | **Not in `Provider` interface** — health handled by `ProviderHealthTracker` in registry |

The `Provider` interface (`provider-interface.ts:202–274`) requires exactly 5 methods. Hermes implements all 5. `health()` is tracked externally by `ProviderHealthTracker`. No incompatibility found.

---

## Error Classification

**Status: PASS**

| HTTP Status | `retryable` Flag | Classification |
|---|---|---|
| 401, 403 | `false` | Auth failure — immediate open |
| 429 | `true` | Rate limit — cooldown |
| 500+ | `true` | Server error — retry with backoff |

Per error: `classifyError(error)` from `@/seed/types/failure-kind`, `recordFailure(SERVICE_NAME, kind)`.

---

## Canary Readiness

**Status: BLOCKED**

| Blocker | Type | Can Resolve? |
|---|---|---|
| Security Gate = BLOCKED | External credential exposure | No — requires account owner action |
| Hermes not in `provider-registry.ts` | Registration gap | Yes (but not in scope for certification) |
| No Hermes runtime reachable from production | Infrastructure | No — local-only plugin |
| No tunnel/reverse-proxy for `127.0.0.1:8100` from CF Workers | Architecture | No — local-only plugin |

**Canary Design (documented, NOT activated):**

```yaml
hermes_canary:
  default: 0%
  experimental_1: 1%     # text tasks only
  experimental_10: 10%
  promote_to_100:
    requires:
      - success_rate >= 99.5%
      - p95_latency < 3000ms
      - error_rate < 0.5%
      - circuit_breaker: CLOSED for 24h
      - no_credential_regression
      - security_gate: PASS
  rollback: immediate     # any threshold breached
```

---

## Production Readiness

**Status: NOT PERFORMED**

Task constraint explicitly forbids deployment. No production deploy, no production smoke test, no production canary.

---

## Classification Rules Applied

```
Rule 1: Security BLOCKED  → max NOT READY     ✓ APPLIED
Rule 2: Security passes, canary not executed → max EXPERIMENTAL READY  (not reached)
Rule 3: Canary evidence successful → PRODUCTION CANDIDATE             (not reached)
Rule 4: Never PRODUCTION READY without actual production evidence      (not reached)
```

---

## Final Classification

```
HERMES PROVIDER CERTIFICATION
Security: BLOCKED
Health: BLOCKED
Capability Truth: PASS
Reliability: PASS
Circuit Breaker: PASS
Economics: PASS
Canary Readiness: BLOCKED
Production Deployment: NOT PERFORMED
Final Classification: NOT READY
STOP.
```

---

## Appendix: Files Verified

| File | Path | Status |
|---|---|---|
| Hermes adapter | `src/seed/ai/providers/hermes-antigravity-adapter.ts` | Uncommitted — V2 modified |
| Hermes capabilities | `src/seed/ai/providers/hermes-capabilities.ts` | Uncommitted — new file |
| Mock contract tests | `src/seed/ai/providers/__tests__/hermes-intelligence-adapter.test.ts` | Uncommitted — new file, 17 tests, 9 categories |
| Adapter unit tests | `src/seed/ai/providers/__tests__/hermes-antigravity-adapter.test.ts` | Uncommitted — V2 modified, 19 tests |
| Cost estimator | `src/seed/ai/cost-estimator.ts` | Uncommitted — V2 modified |
| Cost-aware router | `src/forest/ai/cost-aware-router.ts` | Uncommitted — V2 modified |
| Creative types | `src/seed/types/creative.ts` | Uncommitted — barrel export extended |
| Creative intelligence | `src/seed/types/creative-intelligence.ts` | Uncommitted — new file |
| Creative storyboard | `src/seed/types/creative-storyboard.ts` | Uncommitted — new file |
| V2 documentation | `docs/HERMES_INTELLIGENCE_V2.md` | Uncommitted — new file |
| V2 ship report | `plans/reports/hermes-intelligence-v2-ship-report.md` | Uncommitted — new file |
| CEO audit | `docs/CEO_HANDOVER_AUDIT.md` | Committed — security finding documented |
| Provider interface | `src/seed/ai/provider-interface.ts` | Committed — contract definition |
| Provider registry | `src/seed/ai/provider-registry.ts` | Committed — Hermes NOT registered |

---

## Appendix: Test Results (Certification Baseline)

| Command | Result |
|---|---|
| `npx vitest run hermes-intelligence-adapter.test.ts` | 17/17 passed (9 categories) |
| `npx vitest run hermes-antigravity-adapter.test.ts` | 19/19 passed |
| Combined Hermes tests | **36/36 passed, 0 failed** |
