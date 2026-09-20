# E2E Test Infra: Autonomous Growth & Revenue Engine ($1M MRR Path)

## Test Philosophy
- Opaque-box, requirement-driven, derived strictly from `ORIGINAL_REQUEST.md` and user specifications.
- Completely decoupled from internal implementation details.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|---------------------|:------:|:------:|:------:|:------:|
| 1 | Hermes V2 Trend Scouting (TikTok, Shorts, X) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Mathematical Hook Scoring & SES Forecast | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Autonomous Daily Campaign Generator | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Closed-Loop Viral Feedback & OCC CAS | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | Marketplace Discovery UI (/marketplace, /vi/marketplace) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 6 | One-Click Studio Blueprint Cloning & Cost Preflight | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 7 | Creator Royalty Attribution & Ledger Lineage | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 8 | 5-Network Affiliate Webhook Ingestion & HMAC | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 9 | 14-Day Anti-Fraud Clawback Hold & Dual-Entry Ledger | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 10 | NOWPayments USDT Mass Payouts & Daily Reconciliation | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 11 | Mekong Cloudflare Tunnel & Hybrid Edge Router | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 12 | 15-Second Edge Node Health & Failover | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test runner: Vitest / Playwright (`tests/e2e/growth-engine/`)
- Test case format:
  - Input: Opaque user parameters, HTTP requests, webhook payloads, signed headers.
  - Expected: HTTP responses, database states, ledger entries, cost calculations, fallback executions.
- Directory layout:
  `tests/e2e/growth-engine/`
  ├── tier1-feature-coverage.test.ts
  ├── tier2-boundary-corner.test.ts
  ├── tier3-pairwise-combinations.test.ts
  └── tier4-real-world-scenarios.test.ts

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Viral Loop: Trend discovery -> hook scoring -> daily campaign generation -> publishing -> viral feedback OCC update | F1, F2, F3, F4 | High |
| 2 | Creator Economy Flow: Marketplace listing -> search & filter -> 1-click studio clone -> preflight cost -> mission creation -> royalty accrual | F5, F6, F7 | High |
| 3 | Multi-Network Revenue & Payout: Webhooks for 5 networks -> HMAC verification -> 14-day hold -> negative-row refund clawback -> NOWPayments USDT batch | F8, F9, F10 | High |
| 4 | Hybrid Edge Execution & Auto-Failover: Local M1 Max node online -> unmetered routing -> sudden node disconnect -> 15s health detection -> cloud BYOK fallback | F11, F12 | High |
| 5 | End-to-End Enterprise Growth Engine: Trend-driven blueprint published by creator -> remixed by affiliate -> viral sales on TikTok Shop -> automated split payout | F1, F3, F6, F7, F8, F10 | Critical |

## Coverage Thresholds
- Tier 1: 5 test cases per feature (12 features * 5 = 60 test cases)
- Tier 2: 5 test cases per feature (12 features * 5 = 60 test cases)
- Tier 3: Pairwise coverage across major feature interactions (15 test cases)
- Tier 4: Real-world end-to-end user workflows (5 realistic scenarios)
- Total Expected Coverage: >= 140 test cases
