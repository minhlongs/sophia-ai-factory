# E2E Test Infra: Sophia AI Factory Next Horizon

## Test Philosophy
- Opaque-box, requirement-driven. Derives from ORIGINAL_REQUEST.md and bilingual user journeys.
- Methodology: Category-Partition + BVA + Pairwise + Real-World Workload Testing.
- Bilingual verification: Assertions check both Vietnamese (VI) and English (EN) customer experiences.
- Fail-closed security & reliability verification: Verifies zero HTTP 500 errors, TTFB < 300ms, and zero unhandled client-side exceptions.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | Guest Discovery & Auth (`/vi/login`, `/en/login`, `/register`) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | 6-Step Onboarding Setup Wizard (`/setup`, `/setup-wizard`) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Creative Studio Mission Creation (`/dashboard/missions/new`) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Scheduled Distribution & Publishing Queue (`/dashboard/videos`) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Subscription Checkout (NOWPayments USDT & PayOS VN QR) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Performance Benchmark (TTFB < 300ms, 0 client exceptions) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test runner: Playwright (`npx playwright test`)
- Test suite file: `apps/sophia-ai-factory/tests/e2e/customer-journey-next-horizon.spec.ts`
- Benchmark script: `apps/sophia-ai-factory/tests/perf/customer-journey-benchmark.spec.ts`
- Pass/Fail Semantics: Exit code 0, 100% assertions pass, TTFB < 300ms, zero console error unhandled exceptions.

## Coverage Thresholds
- Tier 1: ≥5 per feature (isolated happy path, VI and EN)
- Tier 2: ≥5 per feature (edge cases, invalid tokens, zero amounts, expired sessions)
- Tier 3: Pairwise combinations (e.g., Setup BYOK -> Mission creation; Mission creation -> Distribution queue; Checkout -> Tier upgrade)
- Tier 4: Realistic end-to-end customer journey scenarios (from landing to published video and revenue attribution)
