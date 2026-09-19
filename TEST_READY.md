# TEST_READY: Comprehensive Playwright Customer Journey E2E & Reliability Suite (Phase 15 / R1)

**Status**: READY (100% Passing)  
**Test Suite Paths**:
- `apps/sophia-ai-factory/tests/e2e/customer-journey-next-horizon.spec.ts` (57 tests)
- `apps/sophia-ai-factory/tests/perf/customer-journey-benchmark.spec.ts` (14 tests)  
**Execution Commands**:
- E2E Suite:
  ```bash
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  cd apps/sophia-ai-factory
  npx playwright test tests/e2e/customer-journey-next-horizon.spec.ts
  ```
- Performance Benchmark Suite:
  ```bash
  export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  cd apps/sophia-ai-factory
  npx playwright test -c tests/perf customer-journey-benchmark.spec.ts
  ```
**Total Test Count**: 71 tests (57 E2E Customer Journey + 14 Performance & Latency Benchmark)  
**Pass Rate**: 71 / 71 (100% Pass)  
**Target Environment**: Live Cloudflare Edge Deployment (`https://sophia.agencyos.network`, commit `a4ef591d`)  

---

## 1. 4-Tier Test Coverage Breakdown

| Tier | Category | Minimum Required | Actual Implemented | Pass / Fail | Description |
|---|---|:---:|:---:|:---:|---|
| **Tier 1** | Core Journey Feature Paths | ≥25 | **31** (25 E2E + 6 Perf) | **31 / 31 PASS** | Complete coverage of primary happy paths across 5 customer journey pillars + 6 baseline route latency verifications: Vietnamese & English localized discovery and sign-in, onboarding setup wizard page rendering and readiness audit, Creative Studio mission pre-flight MCU & USD pricing calculator (30s, 45s, 60s), video catalog queries and publishing dispatch routes, NOWPayments live invoice generation for authenticated subscribers, and sub-300ms median TTFB on `/api/version`. |
| **Tier 2** | Boundary, Corner Cases & Concurrency | ≥25 | **30** (25 E2E + 5 Perf) | **30 / 30 PASS** | Exhaustive fail-closed boundary testing: invalid registration payloads, magic-link validation rejections, setup wizard BYOK probe validation rejections (400/401/422 fail-closed), double-submit CSRF rejection (403 `csrf_token_invalid`), negative budget bounds on mission creation, pagination limits ($N=0$ and $N=150$), 10-request parallel concurrency bursts on edge and D1 endpoints with zero connection drops, unknown route resilience (clean 401/404, 0 HTTP 500s), and PayOS annual subscription restriction guard. |
| **Tier 3** | Cross-Feature Pairwise Integrations | ≥5 | **7** (5 E2E + 2 Perf) | **7 / 7 PASS** | End-to-end multi-feature integrations: (1) Guest Auth → Setup Wizard Readiness: newly provisioned user inherits BASIC tier with initial 50 MCU balance; (2) BYOK Readiness → Preflight Mission Costing: starter 30s mission cost (30 MCU) guaranteed within initial balance; (3) Studio Mission → Distribution Channels: contract verification across all 13 supported social channels; (4) Checkout → Tier Configuration Parity: all 4 canonical tiers mapped; (5) Bilingual Continuity: locale route symmetry across VI and EN; (6) 4-step sequential discovery journey within latency budget; (7) Bilingual route parity: latency delta between VI and EN within 250ms. |
| **Tier 4** | Real-World Workload Scenarios & Benchmarks | ≥2 | **3** (2 E2E + 1 Perf) | **3 / 3 PASS** | Full lifecycle autonomous workflows executed on live production edge: (1) Autonomous Vietnamese Journey: Landing → Session Audit → 60s Video Cost Estimate (50 MCU, transparent USD breakdown) → Live NOWPayments USDT invoice creation; (2) Autonomous English Journey: Discovery → English Setup Audit → PayOS Yearly Rejection Guard (bilingual error) → Video Catalog listing; (3) 20-sample production edge route latency benchmark certifying median TTFB < 300ms and exactly 0 unhandled exceptions (0 HTTP 500s). |
| **Total** | **All Tiers** | **≥57** | **71** | **71 / 71 PASS** | **100% Green All Tiers** |

---

## 2. Feature Inventory & Verification Matrix

| # | Feature Domain | Requirement Spec | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Status |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| 1 | Guest Discovery & Authentication | ORIGINAL_REQUEST §R1 (`/vi/login`, `/en/login`, `/register`) | 5 | 5 | ✓ | ✓ | ✅ VERIFIED |
| 2 | 6-Step Onboarding Setup Wizard | ORIGINAL_REQUEST §R1 (`/setup`, `/setup-wizard`, BYOK) | 5 | 5 | ✓ | ✓ | ✅ VERIFIED |
| 3 | Creative Studio Mission Creation | ORIGINAL_REQUEST §R1 (`/dashboard/missions/new`, MCU/USD) | 5 | 5 | ✓ | ✓ | ✅ VERIFIED |
| 4 | Scheduled Distribution & Publishing | ORIGINAL_REQUEST §R1 (`/dashboard/videos`, 13 channels) | 5 | 5 | ✓ | ✓ | ✅ VERIFIED |
| 5 | Self-Serve Subscription Checkout | ORIGINAL_REQUEST §R1 (NOWPayments USDT, PayOS VN QR) | 5 | 5 | ✓ | ✓ | ✅ VERIFIED |
| 6 | Edge Performance & Exception Guard | ORIGINAL_REQUEST §R1 (TTFB < 300ms, 0 unhandled exceptions) | 6 | 5 | 2 | 1 | ✅ VERIFIED |

---

## 3. Key Invariants & Architectural Contracts Verified

1. **Bilingual Route Symmetry (VI + EN)**:
   - Verified that `/login`, `/setup`, and `/pricing` serve localized Vietnamese (`/vi/*`) and English (`/en/*`) versions with HTTP 200.
   - Unprefixed root paths (`/pricing`, `/setup`, `/setup-wizard`) issue canonical HTTP 307 redirects to localized destinations (`/vi/pricing`, `/vi/setup`).
2. **Double-Submit Cookie CSRF Defense**:
   - Verified that mutating state endpoints (`/api/checkout`, `/api/setup-wizard/validate-key`) enforce double-submit CSRF validation (`csrf-token` cookie + `x-csrf-token` header). Missing or mismatched tokens fail closed with HTTP 403 `csrf_token_invalid`.
3. **Fail-Closed Upstream BYOK Key Validation**:
   - Tested invalid upstream API keys against `/api/setup-wizard/validate-key`. Provider rejects fail closed with HTTP 400/401/422, never permitting invalid keys to pass through.
4. **Subscription Provider Routing & Constraints**:
   - NOWPayments USDT flow successfully provisions live invoice URLs and `sophia_` prefixed order IDs.
   - PayOS VND payment flow strictly enforces Vietnamese banking policy: annual billing requests are rejected with explicit bilingual error guidance directing users to NOWPayments USDT for yearly subscriptions.
5. **Deterministic Pre-flight MCU & USD Cost Calculation**:
   - `calculateMcuCredits`: $\le 30\text{s} \to 30\text{ MCU}$, $\le 45\text{s} \to 40\text{ MCU}$, $> 45\text{s} \to 50\text{ MCU}$ (capped).
   - `estimateMissionPreflightUsd`: Computes transparent multi-model cost breakdown (scripting + ElevenLabs TTS voice + visual frame rendering) with zero hidden fees.
6. **Edge Latency SLO Compliance**:
   - Cloudflare edge endpoint `/api/version` consistently achieves median TTFB < 300ms (~235–250ms).
   - 20-sample live benchmark certified 0 unhandled server exceptions (0 HTTP 500s).

---

## 4. Environment & Test Execution Evidence

- **TypeScript Compilation**: `npx tsc --noEmit --project tsconfig.json` → **0 errors** (clean build).
- **ESLint Compliance**: `npx eslint tests/e2e/customer-journey-next-horizon.spec.ts tests/perf/customer-journey-benchmark.spec.ts` → **0 errors**.
- **Playwright E2E Suite Run**:
  - Command: `npx playwright test tests/e2e/customer-journey-next-horizon.spec.ts`
  - Output: `57 passed (34.8s)`
- **Playwright Perf Benchmark Suite Run**:
  - Command: `npx playwright test -c tests/perf customer-journey-benchmark.spec.ts`
  - Output: `14 passed (24.1s)`
- **Total Suite Execution**: 71 passed, 0 failed, 0 skipped.
