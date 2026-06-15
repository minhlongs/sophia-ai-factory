---
title: "Phase 3: Intelligence Engine"
description: "Implementing the SPS Algorithm to identify high-potential 'Hidden Gems'."
status: completed
priority: P1
effort: 1.5 weeks
tags: [phase3, algorithm, scoring, intelligence]
created: 2026-02-05
---

# Phase 3: Intelligence Engine (謀攻 - Attack by Stratagem)

**Goal:** Implement the **Sophia Potential Score (SPS)** to separate "Gold" from "Gravel". This is the core value proposition for Option B users.

**Context:**
- **Binh-Pháp Principle:** "Hence to fight and conquer in all your battles is not supreme excellence; supreme excellence consists in breaking the enemy's resistance without fighting."
- **Focus:** Algorithm efficiency, "Hidden Gem" logic.

## Key Insights
- **SPS Formula:** $SPS = (w_1 \cdot N_{comm}) + (w_2 \cdot N_{pop}) + (w_3 \cdot N_{rel})$
- **Velocity Matters:** A product jumping from Rank 1000 to Rank 200 is more valuable than one stable at Rank 50 (saturated).
- **Batch Processing:** Calculate scores in batch after ingestion, not on read.

## Requirements

### Functional
1.  **Normalization Service:** Functions to map raw metrics to 0-100 scale.
2.  **SPS Calculator:** Apply weights (configurable).
3.  **Gem Detector:** Boolean flag for "High Velocity, Low Saturation".

### Non-Functional
1.  **Configurability:** Weights ($w_1, w_2, w_3$) should be adjustable via Env Vars or Admin DB without code deploy.
2.  **Testability:** 100% unit test coverage for the scoring logic.

## Architecture: Scoring Logic

```typescript
// Config
const WEIGHTS = {
  COMMISSION: 0.4,
  POPULARITY: 0.3,
  RELIABILITY: 0.3
};

function calculateSPS(product: Product, history: MetricHistory[]): number {
  const nComm = normalizeCommission(product.avg_earnings);
  const nPop = normalizePopularity(product.raw_metrics, product.network);
  const nRel = normalizeReliability(product.raw_metrics);

  let score = (nComm * WEIGHTS.COMMISSION) +
              (nPop * WEIGHTS.POPULARITY) +
              (nRel * WEIGHTS.RELIABILITY);

  // Velocity Boost
  if (calculateVelocity(history) > 20) {
    score *= 1.2; // 20% Boost
  }

  return Math.min(score, 100);
}
```

## Implementation Steps

1.  **Normalization Utils:**
    - `normalizeClickBankGravity(g)`: Logarithmic scale.
    - `normalizeShareASaleRank(r)`: Inverse linear.

2.  **Scoring Service:**
    - Fetch products + history.
    - Run calculation.
    - Bulk Update `sps_score` and `is_hidden_gem`.

3.  **Testing Suite:**
    - Create "Gold Standard" test cases (Known good products).
    - Verify they score > 80.
    - Verify "Junk" scores < 30.

## Resource Allocation
- **Backend (100%):** Pure algorithmic logic and database updates.
- **Frontend (0%):** None.

## Victory Metrics
- **Gem Ratio:** In a sample of Top 50, at least 10 (20%) are "Hidden Gems" (High Comm, High Velocity, Low Saturation).
- **Execution Time:** Score 10,000 products in < 30 seconds (Node.js/DB).

## Risk Assessment
- **Risk:** "Winner Takes All" - Only huge products get high scores.
- **Mitigation:** Logarithmic scaling for Popularity prevents Gravity 500 from dwarfing Gravity 50.
